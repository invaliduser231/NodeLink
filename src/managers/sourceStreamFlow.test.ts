import assert from 'node:assert/strict'
import { EventEmitter, once } from 'node:events'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { Readable } from 'node:stream'
import test from 'node:test'

import {
  isStreamControlMessage,
  type StreamControlAction,
  StreamControlRegistry,
  StreamFlowGate
} from './sourceStreamFlow.ts'

class FakeResponse extends EventEmitter {
  accept = true
  written = 0

  write(chunk: Buffer): boolean {
    this.written += chunk.length
    return this.accept
  }
}

class FakeStream {
  paused = false
  destroyed = false

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
  }
}

test('gate signals pause once when the response buffer is full', () => {
  const res = new FakeResponse()
  const signals: StreamControlAction[] = []
  const gate = new StreamFlowGate(res, (action) => signals.push(action))

  gate.write(Buffer.alloc(4))
  assert.deepEqual(signals, [])

  res.accept = false
  gate.write(Buffer.alloc(4))
  gate.write(Buffer.alloc(4))
  assert.deepEqual(signals, ['pause'])
  assert.equal(gate.isPaused, true)
  assert.equal(res.written, 12)

  res.accept = true
  res.emit('drain')
  assert.deepEqual(signals, ['pause', 'resume'])
  assert.equal(gate.isPaused, false)
})

test('gate never pauses targets that cannot report drain', () => {
  const signals: StreamControlAction[] = []
  const gate = new StreamFlowGate({ write: () => false }, (action) =>
    signals.push(action)
  )

  gate.write(Buffer.alloc(4))
  assert.deepEqual(signals, [])
})

test('registry applies a pause that arrived before the stream existed', () => {
  const registry = new StreamControlRegistry()
  registry.register('a', () => {})
  registry.apply('a', 'pause')

  const stream = new FakeStream()
  registry.attach('a', stream)
  assert.equal(stream.paused, true)

  registry.apply('a', 'resume')
  assert.equal(stream.paused, false)
})

test('registry cancels once and forgets the stream', () => {
  const registry = new StreamControlRegistry()
  let cancelled = 0
  registry.register('a', () => cancelled++)

  registry.apply('a', 'cancel')
  registry.apply('a', 'cancel')
  assert.equal(cancelled, 1)
  assert.equal(registry.size, 0)
})

test('registry ignores controls for unknown or released streams', () => {
  const registry = new StreamControlRegistry()
  const stream = new FakeStream()
  registry.register('a', () => {})
  registry.attach('a', stream)
  registry.release('a')

  registry.apply('a', 'pause')
  registry.apply('b', 'pause')
  assert.equal(stream.paused, false)
})

test('control messages are validated before routing', () => {
  assert.equal(
    isStreamControlMessage({
      type: 'streamControl',
      payload: { id: 'a', action: 'pause' }
    }),
    true
  )
  assert.equal(
    isStreamControlMessage({
      type: 'streamControl',
      payload: { id: 'a', action: 'stop' }
    }),
    false
  )
  assert.equal(isStreamControlMessage({ type: 'sourceTask' }), false)
  assert.equal(isStreamControlMessage(null), false)
})

test('a slow client keeps a fast producer from filling server memory', async () => {
  const chunk = Buffer.alloc(3840)
  const registry = new StreamControlRegistry()
  let produced = 0
  let maxBuffered = 0

  const producer = new Readable({
    read() {
      produced += chunk.length
      this.push(chunk)
    }
  })

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'audio/l16' })
    const gate = new StreamFlowGate(res, (action) =>
      registry.apply('stream', action)
    )
    registry.register('stream', () => producer.destroy())
    registry.attach('stream', producer)

    producer.on('data', (data: Buffer) => {
      gate.write(data)
      maxBuffered = Math.max(maxBuffered, res.writableLength)
    })
    res.on('close', () => registry.apply('stream', 'cancel'))
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  const received = await new Promise<number>((resolve, reject) => {
    const req = http.get({ port, host: '127.0.0.1' }, (res) => {
      let total = 0
      res.pause()
      const timer = setInterval(() => {
        const data = res.read() as Buffer | null
        if (data) total += data.length
      }, 20)
      setTimeout(() => {
        clearInterval(timer)
        req.destroy()
        resolve(total)
      }, 600)
    })
    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code !== 'ECONNRESET') reject(err)
    })
  })

  if (!producer.destroyed) await once(producer, 'close')
  await new Promise<void>((resolve) => server.close(() => resolve()))

  assert.ok(received > 0)
  assert.ok(
    produced < 32 * 1024 * 1024,
    `producer ran ahead by ${produced} bytes`
  )
  assert.ok(
    maxBuffered < 4 * 1024 * 1024,
    `response buffered ${maxBuffered} bytes`
  )
  assert.equal(producer.destroyed, true)
})
