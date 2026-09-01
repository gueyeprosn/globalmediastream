/**
 * Définitions de base + construction des lignes StreamTable (SRS + enregistrements).
 * Source unique pour la page d'accueil et /streams.
 */
import type { StreamRow } from "@/components/StreamTable"

export type SrsStreamStat = {
  name: string
  app: string
  stream: string
  bw_in_kbps: number
  /** Publisher actif côté SRS (complète kbps.recv_30s qui peut être 0 temporairement) */
  publishActive?: boolean
  nclients: number
  video?: { width?: number; height?: number; fps?: number }
}

/** Flux considéré « en ondes » : bitrate entrant ou publisher marqué actif par SRS. */
export function isSrsStreamLive(s: Pick<SrsStreamStat, "bw_in_kbps" | "publishActive">): boolean {
  return (s.bw_in_kbps ?? 0) > 0 || Boolean(s.publishActive)
}

export type DashboardBaseRowDef = {
  streamId: string
  name: string
  protocol: StreamRow["protocol"]
  /** Clé SRS stream ; vide pour Icecast */
  srsKey: string
  resolution: string
  fps: string
  hlsOutput: string
  maxBitrateKbps: number
  defaultBitrateKbps?: number
  defaultClients?: number
}

/** Construit la map id → source réellement « en ondes » depuis `/api/streams` (status normalisé `running`). */
export function icecastLiveMapFromStreams(
  apiStreams: ReadonlyArray<{
    id?: string
    protocol?: string
    type?: string
    status?: string
  }>
): Record<string, boolean> {
  const m: Record<string, boolean> = {}
  for (const s of apiStreams) {
    const proto = s.protocol ?? s.type
    if (proto !== "icecast") continue
    const id = s.id
    if (!id) continue
    m[id] = s.status === "running" || s.status === "active"
  }
  return m
}

export const DASHBOARD_STREAM_BASE_ROWS: DashboardBaseRowDef[] = [
  {
    streamId: "toubatv",
    name: "ToubaTV",
    protocol: "SRT",
    srsKey: "toubatv",
    resolution: "1280x720",
    fps: "25",
    hlsOutput: "https://stream.broadcastsn.com/toubatv/index.m3u8",
    maxBitrateKbps: 6000,
  },
  {
    streamId: "external-tv",
    name: "External TV",
    protocol: "SRT",
    srsKey: "external-tv",
    resolution: "1920x1080",
    fps: "25",
    hlsOutput: "https://stream.broadcastsn.com/external-tv/index.m3u8",
    maxBitrateKbps: 8000,
  },
  {
    streamId: "oceanfm",
    name: "Ocean FM",
    protocol: "ICECAST",
    srsKey: "",
    resolution: "Audio",
    fps: "-",
    hlsOutput: "https://stream.broadcastsn.com/radio/ocean-fm",
    maxBitrateKbps: 320,
    defaultBitrateKbps: 128,
    defaultClients: 0,
  },
  {
    streamId: "external-tv-2",
    name: "External TV 2",
    protocol: "SRT",
    srsKey: "external-tv-2",
    resolution: "-",
    fps: "-",
    hlsOutput: "https://stream.broadcastsn.com/external-tv-2/index.m3u8",
    maxBitrateKbps: 8000,
  },
  {
    streamId: "external-tv-3",
    name: "External TV 3",
    protocol: "SRT",
    srsKey: "external-tv-3",
    resolution: "-",
    fps: "-",
    hlsOutput: "https://stream.broadcastsn.com/external-tv-3/index.m3u8",
    maxBitrateKbps: 8000,
  },
]

/** IDs dashboard des pipelines SRT → FFmpeg → HLS (systemd), souvent absents de SRS. */
export const FFMPEG_SRT_DASHBOARD_IDS: string[] = DASHBOARD_STREAM_BASE_ROWS.filter(
  (r) => r.protocol === "SRT"
).map((r) => r.streamId)

/**
 * Pipeline systemd SRT→FFmpeg : service actif = pipeline up.
 * La santé « ondes » (LIVE vs DEGRADED) se décide avec `signalState` HLS + SRS.
 */
function isFfmpegSrtPipelineLiveFromApi(entry: {
  status?: string
}): boolean {
  return entry.status === "running" || entry.status === "active"
}

/**
 * Map `streamId` → pipeline FFmpeg considéré actif (service systemd dans `/api/streams`).
 * ToubaTV / External TV — indépendant de SRS et de la sonde HLS locale.
 */
export function ffmpegSrtPipelineLiveMapFromStreams(
  apiStreams: ReadonlyArray<{
    id?: string
    status?: string
    signalState?: string
  }>
): Record<string, boolean> {
  const want = new Set(FFMPEG_SRT_DASHBOARD_IDS)
  const m: Record<string, boolean> = {}
  for (const s of apiStreams) {
    const id = s.id
    if (!id || !want.has(id)) continue
    m[id] = isFfmpegSrtPipelineLiveFromApi(s)
  }
  return m
}

/** Map `streamId` → signal HLS (`live` | `frozen` | `offline`) depuis `/api/streams`. */
export function ffmpegSrtSignalStateMapFromStreams(
  apiStreams: ReadonlyArray<{
    id?: string
    signalState?: string
  }>
): Record<string, string> {
  const want = new Set(FFMPEG_SRT_DASHBOARD_IDS)
  const m: Record<string, string> = {}
  for (const s of apiStreams) {
    const id = s.id
    if (!id || !want.has(id)) continue
    if (s.signalState) m[id] = s.signalState
  }
  return m
}

export type StreamRowWithMeta = StreamRow & { streamId: string; srsKey?: string }

/**
 * Décision produit (LOT 10 / B9) :
 * - LIVE si SRS live, ou pipeline actif avec HLS `live`
 * - DEGRADED si pipeline actif mais HLS `frozen`/`offline` et pas de publisher SRS
 * - OFFLINE sinon (REC prioritaire)
 */
function resolveSrtStatus(opts: {
  recording: boolean
  pipelineLive: boolean
  srsLive: boolean
  signalState?: string
}): StreamRow["status"] {
  if (opts.recording) return "REC"
  const signalBad = opts.signalState === "frozen" || opts.signalState === "offline"
  if (opts.srsLive) return "LIVE"
  if (opts.pipelineLive && signalBad) return "DEGRADED"
  if (opts.pipelineLive) return "LIVE"
  return "OFFLINE"
}

export function buildStreamRowsWithMetaFromSrs(
  streams: SrsStreamStat[],
  isRecording: (streamId: string) => boolean,
  /** Résultat Icecast depuis `/api/streams` (clé = `id` du flux, ex. `oceanfm`). */
  icecastLiveByStreamId: Record<string, boolean> = {},
  /** Pipelines SRT→FFmpeg (`toubatv`, `external-tv`…) depuis `/api/streams`. */
  ffmpegPipelineLiveByStreamId: Record<string, boolean> = {},
  /** signalState HLS par streamId (SRT FFmpeg). */
  ffmpegSignalStateByStreamId: Record<string, string> = {}
): StreamRowWithMeta[] {
  const base = DASHBOARD_STREAM_BASE_ROWS

  const mappedRows: StreamRowWithMeta[] = base.map((m) => {
    const srs = m.srsKey ? streams.find((s) => s.stream === m.srsKey) : undefined

    let bitrateKbps: number
    let clients: number
    let status: StreamRow["status"]

    if (m.protocol === "ICECAST") {
      const isLive = Boolean(icecastLiveByStreamId[m.streamId])
      bitrateKbps = isLive ? (m.defaultBitrateKbps ?? 128) : 0
      clients = isLive ? (m.defaultClients ?? 0) : 0
      status = isRecording(m.streamId) ? "REC" : isLive ? "LIVE" : "OFFLINE"
    } else {
      const pipelineLive = Boolean(ffmpegPipelineLiveByStreamId[m.streamId])
      const srsLive = srs ? isSrsStreamLive(srs) : false
      bitrateKbps = srs?.bw_in_kbps ?? m.defaultBitrateKbps ?? 0
      clients = srs?.nclients ?? m.defaultClients ?? 0
      status = resolveSrtStatus({
        recording: isRecording(m.streamId),
        pipelineLive,
        srsLive,
        signalState: ffmpegSignalStateByStreamId[m.streamId],
      })
    }

    const isUp = status === "LIVE" || status === "DEGRADED" || status === "REC"
    return {
      streamId: m.streamId,
      srsKey: m.srsKey || undefined,
      name: m.name,
      protocol: m.protocol,
      status,
      bitrateKbps,
      resolution: m.resolution,
      fps: m.fps,
      clients,
      duration: status === "DEGRADED" ? "DEGRADED" : isUp ? "LIVE" : "-",
      hlsOutput: m.hlsOutput,
      maxBitrateKbps: m.maxBitrateKbps,
    }
  })

  const discoveredSrtRows: StreamRowWithMeta[] = streams
    .filter((s) => s.app === "live" && Boolean(s.stream))
    .filter((s) => !base.some((m) => m.srsKey === s.stream))
    .map((s) => {
      const streamId = s.stream || ""
      const rec = isRecording(streamId)
      const isLive = isSrsStreamLive(s)
      const status: StreamRow["status"] = rec ? "REC" : isLive ? "LIVE" : "OFFLINE"
      return {
        streamId,
        srsKey: s.stream,
        name: s.name || s.stream || "SRT",
        protocol: "SRT" as const,
        status,
        bitrateKbps: s.bw_in_kbps || 0,
        resolution:
          s.video?.width && s.video?.height ? `${s.video.width}x${s.video.height}` : "-",
        fps: s.video?.fps ? String(s.video.fps) : "-",
        clients: s.nclients || 0,
        duration: isLive ? "LIVE" : "-",
        hlsOutput: `https://stream.broadcastsn.com/live/${s.stream}/index.m3u8`,
        maxBitrateKbps: 8000,
      }
    })

  /* Toujours garder les lignes SRT prédéfinies (FFmpeg) même si SRS ne les liste pas. */
  return [...mappedRows, ...discoveredSrtRows]
}

export function buildStreamRowsFromSrs(
  streams: SrsStreamStat[],
  isRecording: (streamId: string) => boolean,
  icecastLiveByStreamId: Record<string, boolean> = {},
  ffmpegPipelineLiveByStreamId: Record<string, boolean> = {},
  ffmpegSignalStateByStreamId: Record<string, string> = {}
): StreamRow[] {
  return buildStreamRowsWithMetaFromSrs(
    streams,
    isRecording,
    icecastLiveByStreamId,
    ffmpegPipelineLiveByStreamId,
    ffmpegSignalStateByStreamId
  ).map(({ streamId: _sid, srsKey: _sk, ...row }) => row)
}
