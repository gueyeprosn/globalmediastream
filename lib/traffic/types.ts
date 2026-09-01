/** Types pour le KPI trafic (SRS + pipelines systemd). */

export type TrafficRole = "publisher" | "player"

export type TrafficConnection = {
  cid: string
  role: TrafficRole
  app: string
  stream: string
  streamKey: string
  ip: string
  country: string | null
  clientType: string
  protocol: string
  startedAt: string | null
  uptimeSec: number | null
  aliveSec: number
  bwInKbps: number
  bwOutKbps: number
  tcUrl: string
  url: string
}

export type TrafficStream = {
  key: string
  app: string
  stream: string
  label: string
  publishActive: boolean
  startedAt: string | null
  uptimeSec: number | null
  publisher: TrafficConnection | null
  players: TrafficConnection[]
  nclients: number
  nPublishers: number
  nPlayers: number
  bwInKbps: number
  bwOutKbps: number
  uniquePlayerIps: number
}

export type TrafficPipeline = {
  id: string
  name: string
  type: "srt" | "rtmp"
  service: string
  status: "active" | "inactive"
  startedAt: string | null
  uptimeSec: number | null
  inputPort: number | null
  hlsUrl: string | null
}

export type TrafficHlsBucket = {
  streamId: string
  viewers: number
  viewerCountries: Record<string, number>
  viewerIps: string[]
}

/** Peer vu dans les logs srt-live-transmit (External TV). */
export type ExternalTvPeer = {
  ip: string
  port: number
  hits: number
  country: string | null
}

/** KPI SRT relay pour un point External TV. */
export type ExternalTvPoint = {
  id: string
  name: string
  inputPort: number
  outputPort: number
  service: string
  serviceActive: boolean
  /** true si débit entrant SRT significatif */
  signalLive: boolean
  recvMbps: number
  sendMbps: number
  recvKbps: number
  sendKbps: number
  rttMs: number | null
  bytesReceived: number | null
  bytesSent: number | null
  bytesLost: number | null
  lossPct: number | null
  publisherIps: ExternalTvPeer[]
  targetConnected: boolean
  logPath: string
  logMtime: string | null
}

export type TrafficSummary = {
  publishers: number
  players: number
  uniqueIps: number
  streamsLive: number
  streamsTotal: number
  bwInKbps: number
  bwOutKbps: number
  pipelinesActive: number
  hlsViewersApprox: number
  externalTvLive: number
}

export type TrafficReport = {
  ok: boolean
  generatedAt: string
  srsReachable: boolean
  srsError?: string
  summary: TrafficSummary
  streams: TrafficStream[]
  connections: TrafficConnection[]
  pipelines: TrafficPipeline[]
  hlsViewers: TrafficHlsBucket[]
  externalTv: ExternalTvPoint[]
}
