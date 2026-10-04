import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isWebmYouTubeStream,
  shouldUseSeekableReader
} from './streamRouting.ts'

const url = 'https://rr1---sn.googlevideo.com/videoplayback?id=1'

test('youtube opus streams skip the seekable reader', () => {
  for (const itag of [249, 250, 251]) {
    assert.equal(
      shouldUseSeekableReader('youtube', { url, additionalData: { itag } }),
      false
    )
  }
})

test('youtube m4a streams keep the seekable reader', () => {
  assert.equal(
    shouldUseSeekableReader('youtube', { url, additionalData: { itag: 140 } }),
    true
  )
  assert.equal(
    shouldUseSeekableReader('ytmusic', { url, format: 'audio/mp4' }),
    true
  )
})

test('deezer, local, hls and sabr never use the seekable reader', () => {
  assert.equal(shouldUseSeekableReader('deezer', { url }), false)
  assert.equal(shouldUseSeekableReader('local', { url }), false)
  assert.equal(
    shouldUseSeekableReader('soundcloud', { url, protocol: 'hls' }),
    false
  )
  assert.equal(
    shouldUseSeekableReader('youtube', { url, protocol: 'sabr' }),
    false
  )
})

test('plain http sources keep the seekable reader', () => {
  assert.equal(shouldUseSeekableReader('soundcloud', { url }), true)
  assert.equal(shouldUseSeekableReader('http', { url }), true)
})

test('a result without a url never uses the seekable reader', () => {
  assert.equal(shouldUseSeekableReader('http', {}), false)
})

test('webm detection falls back to the format and defaults to webm for youtube', () => {
  assert.equal(isWebmYouTubeStream('youtube', { format: 'audio/webm' }), true)
  assert.equal(isWebmYouTubeStream('youtube', { format: { itag: 140 } }), false)
  assert.equal(isWebmYouTubeStream('youtube', {}), true)
  assert.equal(
    isWebmYouTubeStream('soundcloud', { format: 'audio/webm' }),
    false
  )
})
