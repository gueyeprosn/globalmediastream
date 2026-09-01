import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { getSrtStreamsRegistryPath } from '@/lib/paths'
import {
  assertSafeStreamRouteId,
  isSafeSystemdUnit,
  spawnCapture,
  systemctlIsActive,
  systemctlShowLoadState,
} from '@/lib/safe-shell'
import { getStreamMetrics } from '@/lib/stream-monitoring/ffprobe'

export type StreamHealthStatus = 'provisioning' | 'healthy' | 'degraded' | 'failed'

export type StreamHealthReport = {
  id: string
  status: StreamHealthStatus
  serviceActive: boolean
  hlsReachable: boolean
  hlsUrl?: string
  bitrateKbps?: number
  resolution?: string
  lastCheck: string
  details: string[]
}

const RTMP_STREAMS_FILE = process.env.RTMP_STREAMS_REGISTRY_PATH || '/srv/rtmp-streams.json'

export function hlsUrlToLocalPath(hlsUrl: string): string | null {
  try {
    const url = new URL(hlsUrl)
    const p = url.pathname

    if (p.startsWith('/live/')) {
      return `/srv/rtmp-hls${p}`
    }
    if (p.startsWith('/rtmp-hls/')) {
      const m = p.match(/^\/rtmp-hls\/([a-zA-Z0-9-]+)\/(.+)$/)
      if (m) return `/srv/rtmp-${m[1]}/hls/${m[2]}`
    }
    if (p === '/toubatv/index.m3u8') return '/srv/toubatv/hls/index.m3u8'
    if (p === '/external-tv/index.m3u8') return '/srv/external-tv/hls/index.m3u8'
    if (p === '/external-tv-2/index.m3u8') return '/srv/external-tv-2/hls/index.m3u8'
    if (p === '/external-tv-3/index.m3u8') return '/srv/external-tv-3/hls/index.m3u8'
    if (p.startsWith('/dakar-hls/') || p.startsWith('/live-hls/')) {
      return `/srv/rtmp-hls${p.replace(/-hls\//, '/')}`
    }
  } catch {
    /* ignore */
  }
  return null
}

async function serviceExists(serviceName: string): Promise<boolean> {
  if (!isSafeSystemdUnit(serviceName)) return false
  try {
    const loadState = await systemctlShowLoadState(serviceName)
    return loadState !== '' && loadState !== 'not-found'
  } catch {
    return false
  }
}

export async function resolveServiceUnit(id: string): Promise<string | null> {
  assertSafeStreamRouteId(id)
  if (id.includes('rtmp-output')) {
    const base = id.replace('-rtmp-output', '')
    assertSafeStreamRouteId(base)
    const unit = `${base}-rtmp-output.service`
    return isSafeSystemdUnit(unit) && (await serviceExists(unit)) ? unit : null
  }
  if (id.startsWith('rtmp-')) {
    const n = `${id}.service`
    return isSafeSystemdUnit(n) && (await serviceExists(n)) ? n : null
  }
  const rtmpPrefixed = `rtmp-${id}.service`
  if (await serviceExists(rtmpPrefixed)) return rtmpPrefixed
  const plain = `${id}.service`
  if (await serviceExists(plain)) return plain
  return null
}

type StreamMeta = { hlsUrl?: string; service?: string }

async function loadStreamMeta(id: string): Promise<StreamMeta> {
  const staticMap: Record<string, StreamMeta> = {
    toubatv: {
      service: 'toubatv.service',
      hlsUrl: 'https://stream.broadcastsn.com/toubatv/index.m3u8',
    },
    'external-tv': {
      service: 'external-tv.service',
      hlsUrl: 'https://stream.broadcastsn.com/external-tv/index.m3u8',
    },
    'external-tv-2': {
      service: 'external-tv-2.service',
      hlsUrl: 'https://stream.broadcastsn.com/external-tv-2/index.m3u8',
    },
    'external-tv-3': {
      service: 'external-tv-3.service',
      hlsUrl: 'https://stream.broadcastsn.com/external-tv-3/index.m3u8',
    },
  }
  if (staticMap[id]) return staticMap[id]

  try {
    const srtRaw = await readFile(getSrtStreamsRegistryPath(), 'utf8')
    const srtList = JSON.parse(srtRaw) as Array<{ id: string; service?: string; hlsUrl?: string }>
    const srtHit = srtList.find((s) => s.id === id)
    if (srtHit) return { hlsUrl: srtHit.hlsUrl, service: srtHit.service }
  } catch {
    /* ignore */
  }

  try {
    if (existsSync(RTMP_STREAMS_FILE)) {
      const rtmpRaw = await readFile(RTMP_STREAMS_FILE, 'utf8')
      const rtmpList = JSON.parse(rtmpRaw) as Array<{ id: string; service?: string }>
      const rtmpHit = rtmpList.find((s) => s.id === id)
      if (rtmpHit) {
        return {
          service: rtmpHit.service,
          hlsUrl: `https://stream.broadcastsn.com/rtmp-hls/${rtmpHit.id}/stream.m3u8`,
        }
      }
    }
  } catch {
    /* ignore */
  }

  const unit = await resolveServiceUnit(id)
  return unit ? { service: unit } : {}
}

async function checkHlsReachable(hlsUrl: string): Promise<boolean> {
  try {
    const local = hlsUrl.replace('https://stream.broadcastsn.com', 'http://127.0.0.1')
    const { code } = await spawnCapture('curl', ['-sfI', local], { timeoutMs: 5_000 })
    return code === 0
  } catch {
    return false
  }
}

export async function evaluateStreamHealth(id: string): Promise<StreamHealthReport> {
  assertSafeStreamRouteId(id)
  const meta = await loadStreamMeta(id)
  const serviceName = meta.service || (await resolveServiceUnit(id))
  const details: string[] = []

  let serviceActive = false
  if (serviceName) {
    const active = await systemctlIsActive(serviceName)
    serviceActive = active === 'active'
    details.push(`service: ${active}`)
  } else {
    details.push('service: not-found')
  }

  let hlsReachable = false
  if (meta.hlsUrl) {
    hlsReachable = await checkHlsReachable(meta.hlsUrl)
    details.push(`hls: ${hlsReachable ? 'ok' : 'unreachable'}`)
  }

  let bitrateKbps: number | undefined
  let resolution: string | undefined
  if (meta.hlsUrl) {
    const localPath = hlsUrlToLocalPath(meta.hlsUrl)
    const probeUrl = localPath && existsSync(localPath) ? `file://${localPath}` : meta.hlsUrl
    const metrics = await getStreamMetrics(probeUrl, 4_000)
    if (metrics?.bitrateVideo) {
      bitrateKbps = metrics.bitrateVideo + (metrics.bitrateAudio || 0)
      resolution = metrics.resolution
      details.push(`ffprobe: ${resolution || 'ok'}`)
    } else if (meta.hlsUrl.includes('.m3u8')) {
      details.push('ffprobe: no-signal')
    }
  }

  let status: StreamHealthStatus = 'provisioning'
  if (!serviceName) {
    status = 'failed'
  } else if (!serviceActive) {
    status = 'failed'
  } else if (meta.hlsUrl) {
    if (hlsReachable && bitrateKbps) status = 'healthy'
    else if (hlsReachable || serviceActive) status = 'degraded'
    else status = 'failed'
  } else {
    status = serviceActive ? 'healthy' : 'failed'
  }

  return {
    id,
    status,
    serviceActive,
    hlsReachable,
    hlsUrl: meta.hlsUrl,
    bitrateKbps,
    resolution,
    lastCheck: new Date().toISOString(),
    details,
  }
}
