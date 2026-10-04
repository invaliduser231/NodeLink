import { YOUTUBE_WEBM_ITAGS } from '../sources/youtube/common.ts'
import type { TrackUrlResult } from '../typings/sources/source.types.ts'

const SOURCES_REQUIRING_DECRYPTION = new Set(['deezer'])
const YOUTUBE_SOURCES = new Set(['youtube', 'ytmusic'])

type RoutableUrlResult = Pick<
  TrackUrlResult,
  'url' | 'protocol' | 'format' | 'additionalData'
>

export const isWebmYouTubeStream = (
  sourceName: unknown,
  urlResult:
    | Pick<TrackUrlResult, 'format' | 'additionalData'>
    | null
    | undefined
): boolean => {
  if (!YOUTUBE_SOURCES.has(String(sourceName ?? '').toLowerCase())) return false

  const itag = urlResult?.additionalData?.itag
  if (typeof itag === 'number') return YOUTUBE_WEBM_ITAGS.has(itag)

  const format = urlResult?.format
  if (typeof format === 'string') return format.toLowerCase().includes('webm')
  if (typeof format?.itag === 'number')
    return YOUTUBE_WEBM_ITAGS.has(format.itag)
  return true
}

export const shouldUseSeekableReader = (
  sourceName: unknown,
  urlResult: RoutableUrlResult
): boolean => {
  if (!urlResult.url) return false
  if (urlResult.protocol === 'hls' || urlResult.protocol === 'sabr')
    return false

  const normalizedSource = String(sourceName ?? '').toLowerCase()
  if (normalizedSource === 'local') return false
  if (SOURCES_REQUIRING_DECRYPTION.has(normalizedSource)) return false
  return !isWebmYouTubeStream(normalizedSource, urlResult)
}
