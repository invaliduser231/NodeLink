import assert from 'node:assert/strict'
import test from 'node:test'

import { dedupeTracks, interleave } from '../../managers/sourceManager.ts'
import type { TrackData, TrackInfo } from '../../typings/sources/source.types.ts'

function track(info: Partial<TrackInfo>): TrackData {
  return {
    encoded: String(info.title ?? 'x'),
    pluginInfo: {},
    info: {
      identifier: 'id',
      isSeekable: true,
      author: 'Artist',
      length: 200_000,
      isStream: false,
      position: 0,
      title: 'Title',
      uri: 'https://example.test/1',
      artworkUrl: null,
      isrc: null,
      sourceName: 'youtube',
      ...info
    } as TrackInfo
  }
}

test('interleave takes the first hit of every source before the second of any', () => {
  const merged = interleave([
    ['a1', 'a2', 'a3'],
    ['b1', 'b2'],
    ['c1']
  ])

  assert.deepEqual(merged, ['a1', 'b1', 'c1', 'a2', 'b2', 'a3'])
})

test('interleave copes with empty lists', () => {
  assert.deepEqual(interleave([[], [], []]), [])
  assert.deepEqual(interleave([]), [])
})

test('dedupeTracks drops the same recording found by two sources via ISRC', () => {
  const unique = dedupeTracks([
    track({ title: 'Panama', sourceName: 'deezer', isrc: 'DEZC62340830' }),
    track({
      title: 'Panama (Official Video)',
      sourceName: 'youtube',
      uri: 'https://example.test/2',
      isrc: 'dezc-623-408-30'
    })
  ])

  assert.equal(unique.length, 1)
  assert.equal(unique[0]?.info.sourceName, 'deezer')
})

test('dedupeTracks falls back to title, author and duration without ISRC', () => {
  const unique = dedupeTracks([
    track({ title: 'Panama', author: 'GReeeN', length: 152_000 }),
    track({
      title: 'panama!',
      author: 'GReeeN',
      length: 153_000,
      uri: 'https://example.test/2'
    })
  ])

  assert.equal(unique.length, 1)
})

test('dedupeTracks keeps genuinely different tracks', () => {
  const unique = dedupeTracks([
    track({ title: 'Panama', author: 'GReeeN', length: 152_000 }),
    track({
      title: 'Mogli',
      author: 'GReeeN',
      length: 190_000,
      uri: 'https://example.test/2'
    })
  ])

  assert.equal(unique.length, 2)
})

test('dedupeTracks keeps different recordings that share a title', () => {
  const unique = dedupeTracks([
    track({ title: 'Toxicity', author: 'System Of A Down', length: 194_000 }),
    track({
      title: 'Toxicity',
      author: 'System Of A Down',
      length: 240_000,
      uri: 'https://example.test/live'
    })
  ])

  assert.equal(unique.length, 2, 'a live version runs longer and must survive')
})
