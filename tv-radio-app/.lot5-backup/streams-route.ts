import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { getSrtStreamsRegistryPath } from '@/lib/paths'
import {
  isSrsNativePlaceholder,
  journalctlUnitLogs,
  spawnCapture,
  systemctlIsActiveWithTimeout,
  systemctlListUnitFilesHasService,
  toSafeServiceUnit,
} from '@/lib/safe-shell'
const SRT_STREAMS_FILE = getSrtStreamsRegistryPath()

interface DynamicSrtStream {
  id: string
  name: string
  service: string
  inputPort: number
  outputPort?: number
  outputPorts?: number[]
  hlsUrl?: string
  dynamic?: boolean
}

interface StreamConfig {
  id: string
  name: string
  type: 'rtmp' | 'srt' | 'icecast'
  status: 'active' | 'inactive' | 'error'
  service?: string
  inputPort?: number
  outputPort?: number
  hlsUrl?: string
  rtmpInputUrl?: string
  rtmpOutputUrl?: string
  srtInputUrl?: string
  srtOutputUrl?: string
  srtOutputUrls?: string[]
  // Icecast fields
  mountpoint?: string
  serverUrl?: string
  username?: string
  password?: string
  genre?: string
  description?: string
  bitrate?: number
  listeners?: number
  listenerPeak?: number
  streamStart?: string
  inputUrl?: string
  outputUrl?: string
  uptime?: string
  cpu?: number
  memory?: string
  logs?: string[]
  deletable?: boolean
  signalState?: 'live' | 'frozen' | 'offline'
  hlsAgeSec?: number
}

function hlsUrlToLocalPath(hlsUrl: string): string | null {
  try {
    const url = new URL(hlsUrl)
    const p = url.pathname

    // Flux SRS live: /live/<stream>/index.m3u8
    if (p.startsWith('/live/')) {
      return `/srv/rtmp-hls${p}`
    }

    // Flux RTMP dynamiques: /rtmp-hls/<id>/stream.m3u8
    if (p.startsWith('/rtmp-hls/')) {
      const m = p.match(/^\/rtmp-hls\/([a-zA-Z0-9-]+)\/(.+)$/)
      if (m) return `/srv/rtmp-${m[1]}/hls/${m[2]}`
    }

    // Flux HLS statiques
    if (p === '/toubatv/index.m3u8') return '/srv/toubatv/hls/index.m3u8'
    if (p === '/external-tv/index.m3u8') return '/srv/external-tv/hls/index.m3u8'
    if (p === '/external-tv-2/index.m3u8') return '/srv/external-tv-2/hls/index.m3u8'
    if (p === '/external-tv-3/index.m3u8') return '/srv/external-tv-3/hls/index.m3u8'
  } catch {}
  return null
}

async function enrichSignalState(entry: StreamConfig): Promise<StreamConfig> {
  if (!entry.hlsUrl) {
    return {
      ...entry,
      signalState: entry.status === 'active' ? 'live' : 'offline',
    }
  }

  const localPath = hlsUrlToLocalPath(entry.hlsUrl)
  if (!localPath) {
    return {
      ...entry,
      signalState: entry.status === 'active' ? 'live' : 'offline',
    }
  }

  try {
    const info = await stat(localPath)
    const ageSec = Math.max(0, Math.floor((Date.now() - info.mtimeMs) / 1000))
    if (ageSec <= 8) return { ...entry, signalState: 'live', hlsAgeSec: ageSec }
    if (ageSec <= 120) return { ...entry, signalState: 'frozen', hlsAgeSec: ageSec }
    return { ...entry, signalState: 'offline', hlsAgeSec: ageSec }
  } catch {
    return { ...entry, signalState: 'offline' }
  }
}

async function getServiceStatus(serviceName: string): Promise<{ status: string, uptime: string, cpu: number, memory: string }> {
  if (isSrsNativePlaceholder(serviceName)) {
    return { status: 'active', uptime: 'N/A', cpu: 0, memory: '0 MB' }
  }
  try {
    const unit = toSafeServiceUnit(serviceName)
    const status = await systemctlIsActiveWithTimeout(unit, 1200)
    return { status, uptime: 'N/A', cpu: 0, memory: '0 MB' }
  } catch {
    return { status: 'inactive', uptime: 'N/A', cpu: 0, memory: '0 MB' }
  }
}

async function getStreamLogs(serviceName: string, lines: number = 20): Promise<string[]> {
  try {
    if (isSrsNativePlaceholder(serviceName)) return []
    const unit = toSafeServiceUnit(serviceName)
    const stdout = await journalctlUnitLogs(unit, lines, false)
    return stdout.trim().split('\n').filter((line) => line.trim())
  } catch {
    return []
  }
}

async function getDynamicSrtStreams(): Promise<DynamicSrtStream[]> {
  try {
    const content = await readFile(SRT_STREAMS_FILE, 'utf-8')
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((s) => s && s.id && s.service && s.inputPort)
      .map((s) => ({
        id: String(s.id),
        name: String(s.name || s.id),
        service: String(s.service),
        inputPort: Number(s.inputPort),
        outputPort: s.outputPort != null ? Number(s.outputPort) : undefined,
        outputPorts: Array.isArray(s.outputPorts)
          ? s.outputPorts.map((p: unknown) => Number(p)).filter((n: number) => Number.isFinite(n))
          : undefined,
        hlsUrl: s.hlsUrl ? String(s.hlsUrl) : undefined,
        dynamic: true,
      }))
  } catch {
    return []
  }
}

/**
 * Parse la configuration Icecast pour extraire les mount points
 */
async function parseIcecastConfig(): Promise<Map<string, any>> {
  const mountPoints = new Map()
  
  try {
    const { stdout } = await spawnCapture('cat', ['/etc/icecast2/icecast.xml'], { timeoutMs: 10_000 })
    const config = stdout
    
    // Parser chaque mount point
    const mountRegex = /<mount>([\s\S]*?)<\/mount>/g
    let match
    
    while ((match = mountRegex.exec(config)) !== null) {
      const mountBlock = match[1]
      const mountNameMatch = mountBlock.match(/<mount-name>(.*?)<\/mount-name>/)
      if (!mountNameMatch) continue
      
      const mountName = mountNameMatch[1].trim()
      const usernameMatch = mountBlock.match(/<username>(.*?)<\/username>/)
      const passwordMatch = mountBlock.match(/<password>(.*?)<\/password>/)
      const bitrateMatch = mountBlock.match(/<bitrate>(.*?)<\/bitrate>/)
      const streamNameMatch = mountBlock.match(/<stream-name>(.*?)<\/stream-name>/)
      const streamDescMatch = mountBlock.match(/<stream-description>(.*?)<\/stream-description>/)
      const genreMatch = mountBlock.match(/<genre>(.*?)<\/genre>/)
      
      mountPoints.set(mountName, {
        mountpoint: mountName,
        username: usernameMatch ? usernameMatch[1].trim() : 'source',
        password: passwordMatch ? passwordMatch[1].trim() : '',
        bitrate: bitrateMatch ? parseInt(bitrateMatch[1].trim()) : 128,
        streamName: streamNameMatch ? streamNameMatch[1].trim() : mountName,
        description: streamDescMatch ? streamDescMatch[1].trim() : '',
        genre: genreMatch ? genreMatch[1].trim() : 'Various',
      })
    }
  } catch (error) {
    console.error('Erreur lors du parsing de la configuration Icecast:', error)
  }
  
  return mountPoints
}

/**
 * Récupère les sources Icecast actives depuis l'API stats
 */
async function getIcecastSources(): Promise<StreamConfig[]> {
  const icecastStreams: StreamConfig[] = []
  
  try {
    // Récupérer les stats depuis l'API Icecast
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)
    let statsResponse: Response
    try {
      statsResponse = await fetch('http://127.0.0.1:8000/status-json.xsl', {
        cache: 'no-store',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
    
    if (!statsResponse.ok) {
      return icecastStreams
    }
    
    const statsData = await statsResponse.json()
    const sources = statsData.icestats?.source || []
    
    // Parser la configuration pour obtenir les détails
    const mountPoints = await parseIcecastConfig()
    
    // Vérifier le statut du service Icecast
    const icecastStatus = await getServiceStatus('icecast2')
    
    // Set pour éviter les doublons
    const processedMounts = new Set<string>()
    
    for (const source of sources) {
      // Extraire le mountpoint depuis l'URL
      const listenUrl = source.listenurl || ''
      const urlParts = listenUrl.split('/')
      const mountName = urlParts[urlParts.length - 1] || ''
      const normalizedMount = mountName.startsWith('/') ? mountName : `/${mountName}`
      
      // Éviter les doublons
      const mountKey = normalizedMount.toLowerCase()
      if (processedMounts.has(mountKey)) {
        continue
      }
      processedMounts.add(mountKey)
      
      // Chercher la config correspondante (avec ou sans slash)
      const config = mountPoints.get(normalizedMount) || mountPoints.get(mountName) || {}
      
      // Statut « en ondes » : auditeurs, bitrate utile, ou gracieux 5 min après connexion source.
      // (L’ancienne fenêtre 24 h laissait « active » des flux sans encodeur ni auditeurs.)
      const streamStart = source.stream_start_iso8601 ? new Date(source.stream_start_iso8601) : null
      const nowMs = Date.now()
      const listeners = Number(source.listeners) || 0
      const bitrate = Number(source.bitrate) || 0
      const ageMs = streamStart ? nowMs - streamStart.getTime() : Infinity
      const inStartupGrace = streamStart != null && ageMs >= 0 && ageMs < 5 * 60 * 1000
      const isActive =
        listeners > 0 || bitrate > 0 || inStartupGrace
      
      const streamId = normalizedMount.replace(/^\//, '').replace(/\//g, '-')
      
      icecastStreams.push({
        id: streamId,
        name: source.server_name || config.streamName || normalizedMount,
        type: 'icecast',
        status: isActive ? 'active' : 'inactive',
        mountpoint: normalizedMount,
        serverUrl: 'http://stream.broadcastsn.com:8000',
        username: config.username || 'source',
        password: config.password || '',
        genre: source.genre || config.genre || 'Various',
        description: source.server_description || config.description || '',
        bitrate: source.bitrate || config.bitrate || 128,
        listeners: source.listeners || 0,
        listenerPeak: source.listener_peak || 0,
        streamStart: source.stream_start_iso8601 || undefined,
        inputUrl: `icecast://${config.username || 'source'}:${config.password || ''}@127.0.0.1:8000${normalizedMount}`,
        outputUrl: `http://stream.broadcastsn.com:8000${normalizedMount}`,
        uptime: streamStart ? formatUptimeFromDate(streamStart) : 'N/A',
        cpu: icecastStatus.cpu,
        memory: icecastStatus.memory,
      })
    }
    
    // Ajouter les mount points configurés mais non actifs (non présents dans les stats)
    for (const [mountName, config] of mountPoints.entries()) {
      const normalizedMount = mountName.startsWith('/') ? mountName : `/${mountName}`
      const streamId = normalizedMount.replace(/^\//, '').replace(/\//g, '-')
      // Vérifier si le mount point existe déjà (normaliser le mountpoint pour la comparaison)
      const exists = icecastStreams.some(s => {
        const sMount = (s.mountpoint || '').replace(/^\//, '').toLowerCase()
        const mount = normalizedMount.replace(/^\//, '').toLowerCase()
        return sMount === mount
      })
      
      if (!exists) {
        icecastStreams.push({
          id: streamId,
          name: config.streamName || mountName,
          type: 'icecast',
          status: 'inactive',
          mountpoint: mountName.startsWith('/') ? mountName : `/${mountName}`,
          serverUrl: 'http://stream.broadcastsn.com:8000',
          username: config.username || 'source',
          password: config.password || '',
          genre: config.genre || 'Various',
          description: config.description || '',
          bitrate: config.bitrate || 128,
          listeners: 0,
          listenerPeak: 0,
          inputUrl: `icecast://${config.username || 'source'}:${config.password || ''}@127.0.0.1:8000${mountName.startsWith('/') ? mountName : `/${mountName}`}`,
          outputUrl: `http://stream.broadcastsn.com:8000${mountName.startsWith('/') ? mountName : `/${mountName}`}`,
          uptime: 'N/A',
          cpu: icecastStatus.cpu,
          memory: icecastStatus.memory,
        })
      }
    }
  } catch (error: any) {
    console.error('Erreur lors de la récupération des sources Icecast:', error.message)
  }
  
  return icecastStreams
}

/**
 * Formate l'uptime depuis une date
 */
function formatUptimeFromDate(startDate: Date): string {
  const now = new Date()
  const diff = Math.floor((now.getTime() - startDate.getTime()) / 1000)
  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}

/** Vérifie si une unité systemd existe (fichier enregistré) */
async function serviceExists(serviceName: string): Promise<boolean> {
  try {
    const unit = toSafeServiceUnit(serviceName)
    return await systemctlListUnitFilesHasService(unit)
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    const streams: StreamConfig[] = []
    
    // Flux SRT (liste alignée sur les services réels du serveur)
    const srtStreams: Array<{
      id: string
      name: string
      service: string
      inputPort: number
      outputPort?: number
      hlsPath?: string
      hlsUrl?: string
    }> = [
      { id: 'toubatv', name: 'Touba TV', service: 'toubatv.service', inputPort: 6000, outputPort: undefined as number | undefined, hlsPath: '/toubatv/' },
      // Important: ces streams doivent exposer un `hlsUrl` (via `hlsPath`) pour que
      // `/api/streams/advanced` puisse collecter les viewers HLS.
      { id: 'external-tv', name: 'External TV', service: 'external-tv.service', inputPort: 6001, outputPort: 6002, hlsPath: '/external-tv/' },
      { id: 'external-tv-2', name: 'External TV 2', service: 'external-tv-2.service', inputPort: 6003, outputPort: 6004, hlsPath: '/external-tv-2/' },
      { id: 'external-tv-3', name: 'External TV 3', service: 'external-tv-3.service', inputPort: 6005, outputPort: 6006, hlsPath: '/external-tv-3/' },
    ]
    const dynamicSrtStreams = await getDynamicSrtStreams()
    const mergedSrtStreams = [
      ...srtStreams,
      ...dynamicSrtStreams.map((s) => ({
        id: s.id,
        name: s.name,
        service: s.service,
        inputPort: s.inputPort,
        outputPort: s.outputPort,
        outputPorts: s.outputPorts,
        hlsPath: undefined as string | undefined,
        hlsUrl: s.hlsUrl,
        dynamic: true,
      })),
    ].filter(
      (stream, index, arr) =>
        arr.findIndex((s) => s.id === stream.id || s.service === stream.service) === index
    )
    
    // Flux RTMP statiques
    const staticRtmpStreams: Array<{ id: string; name: string; service: string; inputPort: number; outputPort?: number; hasRelay?: boolean; deletable?: boolean }> = []
    
    // Flux RTMP dynamiques (créés via le dashboard)
    let dynamicRtmpStreams: any[] = []
    try {
      const internalAuth = request.headers.get('authorization')
      const rtmpResponse = await fetch(`${request.nextUrl.origin}/api/streams/rtmp`, {
        cache: 'no-store',
        headers: internalAuth ? { Authorization: internalAuth } : undefined,
      })
      if (rtmpResponse.ok) {
        const rtmpData = await rtmpResponse.json()
        dynamicRtmpStreams = (rtmpData.streams || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          service: s.service,
          inputPort: s.inputPort,
          outputPort: s.outputPort,
          hasRelay: false,
          deletable: true,
        }))
      }
    } catch {}
    
    const rtmpStreams = [...staticRtmpStreams, ...dynamicRtmpStreams]
    
    // Traiter les flux SRT (en parallèle + timeouts courts)
    const srtEntries = await Promise.all(
      mergedSrtStreams.map(async (stream) => {
        const isDynamic = Boolean((stream as { dynamic?: boolean }).dynamic)
        const serviceStatus = await getServiceStatus(stream.service)
        const entry: StreamConfig = {
          id: stream.id,
          name: stream.name,
          type: 'srt',
          status: serviceStatus.status === 'active' ? 'active' : 'inactive',
          service: stream.service,
          inputPort: stream.inputPort,
          outputPort: stream.outputPort,
          srtInputUrl: `srt://stream.broadcastsn.com:${stream.inputPort}`,
          uptime: serviceStatus.uptime,
          cpu: serviceStatus.cpu,
          memory: serviceStatus.memory,
          deletable: isDynamic,
        }
        const dyn = stream as { outputPorts?: number[] }
        if (dyn.outputPorts?.length) {
          entry.srtOutputUrls = dyn.outputPorts.map(
            (p) => `srt://stream.broadcastsn.com:${p}`
          )
        }
        if (stream.outputPort) {
          entry.srtOutputUrl = `srt://stream.broadcastsn.com:${stream.outputPort}`
        }
        if (stream.hlsUrl) {
          entry.hlsUrl = stream.hlsUrl
        } else if (stream.hlsPath) {
          entry.hlsUrl = `https://stream.broadcastsn.com${stream.hlsPath}index.m3u8`
        }
        return entry
      })
    )
    streams.push(...srtEntries.filter((s): s is StreamConfig => s !== null))
    
    // Traiter les flux RTMP (en parallèle + timeouts courts)
    const rtmpEntries = await Promise.all(
      rtmpStreams.map(async (stream) => {
        const serviceStatus = await getServiceStatus(stream.service)
        const streamConfig: StreamConfig = {
          id: stream.id,
          name: stream.name,
          type: 'rtmp',
          status: serviceStatus.status === 'active' ? 'active' : 'inactive',
          service: stream.service,
          inputPort: stream.inputPort,
          outputPort: stream.outputPort || undefined,
          rtmpInputUrl: `rtmp://stream.broadcastsn.com:${stream.inputPort}/live/${stream.id}`,
          uptime: serviceStatus.uptime,
          cpu: serviceStatus.cpu,
          memory: serviceStatus.memory,
          deletable: Boolean((stream as { deletable?: boolean }).deletable),
        }
        
        // Lien de lecture HLS
        streamConfig.hlsUrl = `https://stream.broadcastsn.com/rtmp-hls/${stream.id}/stream.m3u8`
        
        if (stream.outputPort) {
          streamConfig.rtmpOutputUrl = `rtmp://stream.broadcastsn.com:${stream.outputPort}/live/${stream.id}_out`
        }
        
        if (stream.hasRelay) {
          const relayService = `${stream.id}-rtmp-output.service`
          const relayStatus = await getServiceStatus(relayService)
          if (relayStatus.status === 'active') {
            streamConfig.status = 'active'
          }
        }
        return streamConfig
      })
    )
    streams.push(...rtmpEntries)
    
    // Récupérer les sources Icecast
    const icecastStreams = await getIcecastSources()
    streams.push(...icecastStreams)

    // Signal temps réel: live / figé / hors-ligne (basé sur activité HLS)
    const streamsWithSignal = await Promise.all(streams.map((s) => enrichSignalState(s)))
    
    return NextResponse.json(
      { streams: streamsWithSignal },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération des flux' },
      { status: 500 }
    )
  }
}
