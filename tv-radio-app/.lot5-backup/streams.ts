export type StreamProtocol = 'srt' | 'rtmp' | 'icecast'
export type StreamStatus = 'running' | 'stopped' | 'error'
export type SRTMode = 'caller' | 'listener' | 'rendezvous'

export interface BaseStream {
  id: string
  name: string
  protocol: StreamProtocol
  status: StreamStatus
  createdAt: string
  updatedAt: string
}

export interface SRTStream extends BaseStream {
  protocol: 'srt'
  mode: SRTMode
  host: string
  port: number
  streamId?: string
  passphrase?: string
  latency: number
  encryption: boolean
  inputUrl: string
  outputUrl: string
}

export interface RTMPStream extends BaseStream {
  protocol: 'rtmp'
  serverUrl: string
  streamKey: string
  application: string
  inputUrl: string
  outputUrl: string
}

export interface IcecastSource extends BaseStream {
  protocol: 'icecast'
  mountpoint: string
  serverUrl: string
  username: string
  password: string
  genre?: string
  description?: string
  bitrate: number
  inputUrl: string
  outputUrl: string
}

export type Stream = SRTStream | RTMPStream | IcecastSource

export interface StreamMetrics {
  streamId: string
  timestamp: number
  bitrate: number
  latency?: number
  jitter?: number
  packetLoss?: number
  retransmissions?: number
  connections: number
  cpuUsage: number
  memoryUsage: number
}

export interface GlobalMetrics {
  totalActiveStreams: number
  totalBandwidth: number
  cpuUsage: number
  memoryUsage: number
  packetLoss: number
  uptime: number
}

export interface Alert {
  id: string
  type: 'error' | 'warning' | 'info'
  message: string
  streamId?: string
  timestamp: number
  acknowledged: boolean
}

export interface AppSettings {
  autoStartStreams: boolean
  defaultLatency: number
  theme: 'light' | 'dark' | 'system'
  updateCheck: boolean
  serverHost: string
  rtmpPort: number
  srtPort: number
  srtLatencyMs: number
  cdnBaseUrl: string
  recordingsPath: string
  ffmpegPath: string
  srtLiveTransmitPath: string
  nginxRtmpPath: string
  icecastPath: string
  uiDensity?: 'comfortable' | 'compact'
}

export interface LogEntry {
  id: string
  timestamp: number
  level: 'info' | 'warning' | 'error'
  message: string
  streamId?: string
  source?: string
}

