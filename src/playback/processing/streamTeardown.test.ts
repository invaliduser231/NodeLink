import assert from 'node:assert/strict'
import { PassThrough, pipeline, Transform } from 'node:stream'
import test from 'node:test'

import { teardownPipe } from './streamTeardown.ts'

const passTransform = (): Transform =>
  new Transform({
    transform(chunk, _encoding, callback) {
      callback(null, chunk)
    }
  })

const nextTicks = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve))

test('an error already queued by the pipeline does not escape after teardown', async () => {
  const uncaught: unknown[] = []
  const onUncaught = (err: unknown): void => {
    uncaught.push(err)
  }
  process.prependListener('uncaughtException', onUncaught)

  try {
    const source = new PassThrough()
    const demuxer = passTransform()
    const decoder = passTransform()
    pipeline(source, demuxer, decoder, () => {})
    decoder.resume()

    source.destroy(new TypeError('terminated'))
    for (const pipe of [decoder, demuxer, source]) teardownPipe(pipe)
    await nextTicks()

    assert.deepEqual(uncaught, [])
    assert.equal(demuxer.destroyed, true)
    assert.equal(decoder.destroyed, true)
  } finally {
    process.removeListener('uncaughtException', onUncaught)
  }
})

test('teardown stops the stream and drops the listeners it had', () => {
  const stream = passTransform()
  let dataEvents = 0
  stream.on('data', () => {
    dataEvents++
  })

  teardownPipe(stream)
  stream.write(Buffer.from('late'))

  assert.equal(stream.destroyed, true)
  assert.equal(stream.listenerCount('data'), 0)
  assert.equal(dataEvents, 0)
})

test('teardown accepts objects that only implement part of the stream api', () => {
  const calls: string[] = []
  teardownPipe({
    destroy: () => {
      calls.push('destroy')
    }
  })

  assert.deepEqual(calls, ['destroy'])
})
