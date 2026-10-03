import assert from 'node:assert/strict'
import test from 'node:test'

import {
  describeWorkerError,
  InflightTaskRegistry,
  isStreamingTask
} from './inflightTasks.ts'

test('drainOwner returns only the tasks of the crashed worker', () => {
  const registry = new InflightTaskRegistry<string>()
  registry.track({ id: 'a', task: 'loadStream', socketPath: '/s' }, 'w1')
  registry.track({ id: 'b', task: 'resolve', socketPath: '/s' }, 'w1')
  registry.track({ id: 'c', task: 'loadStream', socketPath: '/s' }, 'w2')

  const drained = registry.drainOwner('w1')

  assert.deepEqual(
    drained.map((entry) => entry.id),
    ['a', 'b']
  )
  assert.equal(registry.size, 1)
  assert.deepEqual(registry.drainOwner('w1'), [])
})

test('settled tasks are not failed when their worker exits', () => {
  const registry = new InflightTaskRegistry<string>()
  registry.track({ id: 'a', task: 'loadStream', socketPath: '/s' }, 'w1')
  registry.settle('a')

  assert.deepEqual(registry.drainOwner('w1'), [])
})

test('tasks without a reply are never tracked', () => {
  const registry = new InflightTaskRegistry<string>()
  registry.track({ id: 'a', task: 'cancelLiveChat', socketPath: '/s' }, 'w1')
  registry.track({ id: 'b', task: 'streamControl', socketPath: '/s' }, 'w1')

  assert.equal(registry.size, 0)
})

test('streaming tasks are told apart from request tasks', () => {
  assert.equal(isStreamingTask('loadStream'), true)
  assert.equal(isStreamingTask('loadLiveChat'), true)
  assert.equal(isStreamingTask('resolve'), false)
})

test('describeWorkerError keeps the stack and the cause chain on one line', () => {
  const socketError = Object.assign(new Error('other side closed'), {
    code: 'UND_ERR_SOCKET'
  })
  const err = new TypeError('terminated', { cause: socketError })

  const detail = describeWorkerError(err)

  assert.match(detail, /^TypeError: terminated \| at /)
  assert.match(detail, /caused by: \[UND_ERR_SOCKET\] Error: other side closed/)
  assert.doesNotMatch(detail, /\n/)
})

test('describeWorkerError handles non-error values', () => {
  assert.equal(describeWorkerError('boom'), 'boom')
  assert.equal(describeWorkerError(null), 'null')
})
