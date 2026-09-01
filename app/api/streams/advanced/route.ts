/**
 * Endpoint API pour les métriques avancées des flux
 * Inclut: résolution, framerate, bitrate, codec, IP publisher, viewers
 */

import { existsSync } from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import { getStreamMetrics } from '@/lib/stream-monitoring/ffprobe'
import { getPublisherIP } from '@/lib/stream-monitoring/publisher-ip'
import { streamMetricsCache } from '@/lib/stream-monitoring/cache'
import { collectHlsViewerDetails } from '@/lib/monitoring/collectors'
import type { HlsViewerDetail } from '@/lib/monitoring/hls-viewers'
import { requireAuth } from '@/lib/require-auth'

export interface AdvancedStreamMetrics {
  id: string
  name: string
  type: 'rtmp' | 'srt'
  status: 'active' | 'inactive'
  resolution?: string
  width?: number
  height?: number
  framerate?: number
  bitrateVideo?: number
  bitrateAudio?: number
  codecVideo?: string
  codecAudio?: string
  publisherIP?: string
  viewers?: number
  viewerCountries?: Record<string, number>
  viewerIpsSample?: string[]
  lastUpdated?: string
  error?: string
}

const RESPONSE_CACHE_KEY = 'advanced_streams_response'
const RESPONSE_TTL_MS = 20_000
const FFPROBE_TIMEOUT_MS = 2500
const METRIC_TTL_MS = 45_000

/** Empêche les tempêtes de requêtes concurrentes (polling multi-onglets). */
let inFlight: Promise<{ streams: AdvancedStreamMetrics[]; timestamp: string }> | null = null

function mergeHlsViewers(
  metrics: Partial<AdvancedStreamMetrics>,
  hls?: HlsViewerDetail
): Partial<AdvancedStreamMetrics> {
  if (!hls) return metrics
  return {
    ...metrics,
    viewers: hls.viewers,
    viewerCountries: hls.viewerCountries,
    viewerIpsSample: hls.viewerIps,
  }
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return results
}

async function getRTMPAdvancedMetrics(
  streamId: string,
  inputPort: number,
  rtmpInputUrl: string,
  hlsDetail?: HlsViewerDetail
): Promise<Partial<AdvancedStreamMetrics>> {
  const cacheKey = `rtmp_${streamId}_${inputPort}`
  const cached = streamMetricsCache.get<Partial<AdvancedStreamMetrics>>(cacheKey)
  if (cached) return mergeHlsViewers(cached, hlsDetail)

  const metrics: Partial<AdvancedStreamMetrics> = {}

  try {
    const localRtmpUrl = rtmpInputUrl.replace('stream.broadcastsn.com', '127.0.0.1')
    const streamMetrics = await getStreamMetrics(localRtmpUrl, FFPROBE_TIMEOUT_MS)
    if (streamMetrics) {
      metrics.resolution = streamMetrics.resolution
      metrics.width = streamMetrics.width
      metrics.height = streamMetrics.height
      metrics.framerate = streamMetrics.framerate
      metrics.bitrateVideo = streamMetrics.bitrateVideo
      metrics.bitrateAudio = streamMetrics.bitrateAudio
      metrics.codecVideo = streamMetrics.codecVideo
      metrics.codecAudio = streamMetrics.codecAudio
    } else {
      metrics.error = 'Flux non accessible via ffprobe'
    }
  } catch {
    metrics.error = 'Flux non accessible'
  }

  try {
    const publisherIP = await getPublisherIP(inputPort, streamId)
    if (publisherIP) metrics.publisherIP = publisherIP
  } catch {
    /* ignore */
  }

  if (hlsDetail) {
    metrics.viewers = hlsDetail.viewers
    metrics.viewerCountries = hlsDetail.viewerCountries
    metrics.viewerIpsSample = hlsDetail.viewerIps
  }

  metrics.lastUpdated = new Date().toISOString()
  streamMetricsCache.set(cacheKey, metrics, METRIC_TTL_MS)
  return metrics
}

function localHlsPlaylistFromPublicUrl(hlsUrl: string): string | null {
  try {
    const u = new URL(hlsUrl)
    if (!u.hostname.includes('broadcastsn.com') && !u.hostname.includes('localhost')) return null
    const re = /^\/(toubatv|external-tv(?:-[0-9]+)?)\/index\.m3u8$/
    if (!re.test(u.pathname)) return null
    const slug = u.pathname.replace(/\/index\.m3u8$/, '').replace(/^\//, '')
    const filePath = `/srv/${slug}/hls/index.m3u8`
    return existsSync(filePath) ? filePath : null
  } catch {
    return null
  }
}

async function getSRTAdvancedMetrics(
  streamId: string,
  inputPort: number,
  hlsDetail?: HlsViewerDetail,
  hlsUrl?: string
): Promise<Partial<AdvancedStreamMetrics>> {
  const cacheKey = `srt_${streamId}_${inputPort}_${hlsUrl ? 'hls' : 'nohls'}`
  const cached = streamMetricsCache.get<Partial<AdvancedStreamMetrics>>(cacheKey)
  if (cached) return mergeHlsViewers(cached, hlsDetail)

  const metrics: Partial<AdvancedStreamMetrics> = {}

  try {
    const publisherIP = await getPublisherIP(inputPort, streamId)
    if (publisherIP) metrics.publisherIP = publisherIP
  } catch {
    /* ignore */
  }

  const localPl = hlsUrl ? localHlsPlaylistFromPublicUrl(hlsUrl) : null
  if (localPl) {
    try {
      const sm = await getStreamMetrics(`file:${localPl}`, FFPROBE_TIMEOUT_MS)
      if (sm?.width) {
        metrics.resolution = sm.resolution
        metrics.width = sm.width
        metrics.height = sm.height
        metrics.framerate = sm.framerate
        metrics.bitrateVideo = sm.bitrateVideo
        metrics.bitrateAudio = sm.bitrateAudio
        metrics.codecVideo = sm.codecVideo
        metrics.codecAudio = sm.codecAudio
      }
    } catch {
      /* playlist absente */
    }
  }

  metrics.lastUpdated = new Date().toISOString()
  if (!metrics.bitrateVideo && !metrics.width) {
    metrics.error = localPl
      ? 'Sortie HLS locale non lisible (ffprobe)'
      : 'Métriques vidéo : sortie HLS locale requise pour ffprobe'
  } else {
    delete metrics.error
  }

  if (hlsDetail) {
    metrics.viewers = hlsDetail.viewers
    metrics.viewerCountries = hlsDetail.viewerCountries
    metrics.viewerIpsSample = hlsDetail.viewerIps
  }

  streamMetricsCache.set(cacheKey, metrics, METRIC_TTL_MS)
  return metrics
}

async function computeAdvanced(request: NextRequest) {
  const cached = streamMetricsCache.get<{ streams: AdvancedStreamMetrics[]; timestamp: string }>(
    RESPONSE_CACHE_KEY
  )
  if (cached) return cached

  const baseUrl =
    process.env.NODE_ENV === 'production' ? 'http://127.0.0.1:3000' : request.nextUrl.origin
  const cookie = request.headers.get('cookie')
  const internalAuth = request.headers.get('authorization')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)

  let streamsResponse: Response
  try {
    streamsResponse = await fetch(`${baseUrl}/api/streams`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        ...(internalAuth ? { Authorization: internalAuth } : {}),
        ...(cookie ? { cookie } : {}),
      },
    })
  } finally {
    clearTimeout(timer)
  }

  if (!streamsResponse.ok) {
    throw new Error('Impossible de récupérer la liste des flux')
  }

  const { streams } = await streamsResponse.json()

  const hlsStreamIds: string[] = (streams as any[])
    .filter(
      (s) =>
        s?.hlsUrl &&
        typeof s.hlsUrl === 'string' &&
        (s.hlsUrl.includes('.m3u8') ||
          s.hlsUrl.includes('/live/') ||
          s.hlsUrl.includes('/rtmp-hls/') ||
          s.hlsUrl.includes('/toubatv/') ||
          s.hlsUrl.includes('/external-tv'))
    )
    .map((s) => String(s.id))

  const hlsViewerMap = await collectHlsViewerDetails(hlsStreamIds)

  const advancedStreams = await mapPool(streams as any[], 2, async (stream) => {
    const baseMetrics: AdvancedStreamMetrics = {
      id: stream.id,
      name: stream.name,
      type: stream.type,
      status: stream.status,
    }
    const hlsDetail = hlsViewerMap.get(stream.id)

    if (stream.status === 'active') {
      if (stream.type === 'rtmp' && stream.rtmpInputUrl && stream.inputPort) {
        const advanced = await getRTMPAdvancedMetrics(
          stream.id,
          stream.inputPort,
          stream.rtmpInputUrl,
          hlsDetail
        )
        return { ...baseMetrics, ...advanced }
      }
      if (stream.type === 'srt' && stream.inputPort) {
        const advanced = await getSRTAdvancedMetrics(
          stream.id,
          stream.inputPort,
          hlsDetail,
          typeof stream.hlsUrl === 'string' ? stream.hlsUrl : undefined
        )
        return { ...baseMetrics, ...advanced }
      }
    }

    if (hlsDetail) return { ...baseMetrics, ...mergeHlsViewers({}, hlsDetail) }
    return baseMetrics
  })

  const payload = {
    streams: advancedStreams,
    timestamp: new Date().toISOString(),
  }
  streamMetricsCache.set(RESPONSE_CACHE_KEY, payload, RESPONSE_TTL_MS)
  return payload
}

export async function GET(request: NextRequest){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
    if (!inFlight) {
      inFlight = computeAdvanced(request).finally(() => {
        inFlight = null
      })
    }
    const payload = await inFlight
    return NextResponse.json(payload)
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string }
    if (err?.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Timeout métriques avancées', streams: [] },
        { status: 200 }
      )
    }
    console.error('Erreur dans /api/streams/advanced:', err?.message || err)
    return NextResponse.json(
      {
        error: err?.message || 'Métriques avancées indisponibles temporairement',
        streams: [],
      },
      { status: 200 }
    )
  }
}
