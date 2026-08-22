import assert from 'node:assert/strict'
import test from 'node:test'

import { getBestMatch, normalizeIsrc } from '../../utils.ts'
import type { BestMatchTrackInfo } from '../../typings/utils.types.ts'

const MIN_SCORE = 150

function candidate(info: Partial<BestMatchTrackInfo>): {
  info: BestMatchTrackInfo
} {
  return {
    info: {
      title: 'Untitled',
      author: 'Unknown',
      length: 0,
      ...info
    }
  }
}

test('normalizeIsrc accepts formatted codes and rejects anything else', () => {
  assert.equal(normalizeIsrc('DE-ZC6-23-40830'), 'DEZC62340830')
  assert.equal(normalizeIsrc('dezc62340830'), 'DEZC62340830')
  assert.equal(normalizeIsrc('"DEZC62340830"'), 'DEZC62340830')
  assert.equal(normalizeIsrc('too-short'), null)
  assert.equal(normalizeIsrc(null), null)
})

test('a candidate with the same ISRC wins regardless of its title', () => {
  const original: BestMatchTrackInfo = {
    title: 'Panama',
    author: 'GReeeN',
    length: 152_000,
    isrc: 'DEZC62340830'
  }
  const best = getBestMatch(
    [
      candidate({ title: 'Panama', author: 'GReeeN', length: 152_000 }),
      candidate({
        title: 'completely different upload',
        author: 'Some Channel',
        length: 151_000,
        isrc: 'DEZC62340830'
      })
    ],
    original,
    { minScore: MIN_SCORE }
  )

  assert.equal(best?.info.title, 'completely different upload')
})

test('a matching title, artist and duration is accepted', () => {
  const best = getBestMatch(
    [
      candidate({
        title: 'Personality Crisis',
        author: 'New York Dolls',
        length: 221_000
      })
    ],
    { title: 'Personality Crisis', author: 'New York Dolls', length: 221_000 },
    { minScore: MIN_SCORE }
  )

  assert.equal(best?.info.title, 'Personality Crisis')
})

test('an unrelated song is rejected instead of returned as first hit', () => {
  const best = getBestMatch(
    [
      candidate({
        title: 'Aproveita Que Eu To Brigado (Ao Vivo)',
        author: 'NATTAN',
        length: 153_000
      })
    ],
    {
      title: 'Panama',
      author: 'GReeeN',
      length: 152_000,
      isrc: 'DEZC62340830'
    },
    { minScore: MIN_SCORE }
  )

  assert.equal(best, null)
})

test('a live version is rejected when the original is a studio recording', () => {
  const best = getBestMatch(
    [
      candidate({
        title: 'Letzter Smaragd (Live)',
        author: 'GReeeN',
        length: 200_000
      })
    ],
    { title: 'Letzter Smaragd', author: 'GReeeN', length: 199_000 },
    { minScore: MIN_SCORE }
  )

  assert.equal(best, null)
})

test('a wildly different duration is rejected', () => {
  const best = getBestMatch(
    [
      candidate({
        title: 'Letzter Smaragd',
        author: 'GReeeN',
        length: 3_600_000
      })
    ],
    { title: 'Letzter Smaragd', author: 'GReeeN', length: 199_000 },
    { minScore: MIN_SCORE }
  )

  assert.equal(best, null)
})

test('an empty candidate list yields null', () => {
  const best = getBestMatch(
    [],
    { title: 'Panama', author: 'GReeeN', length: 152_000 },
    { minScore: MIN_SCORE }
  )

  assert.equal(best, null)
})

test('requireIsrc refuses candidates that do not carry the same ISRC', () => {
  const best = getBestMatch(
    [candidate({ title: 'Panama', author: 'GReeeN', length: 152_000 })],
    {
      title: 'Panama',
      author: 'GReeeN',
      length: 152_000,
      isrc: 'DEZC62340830'
    },
    { requireIsrc: true }
  )

  assert.equal(best, null)
})

test('without minScore the legacy first-hit behaviour is preserved', () => {
  const unrelated = candidate({
    title: 'something else entirely',
    author: 'Other',
    length: 10_000
  })
  const best = getBestMatch([unrelated], {
    title: 'Panama',
    author: 'GReeeN',
    length: 152_000
  })

  assert.equal(best, unrelated)
})
