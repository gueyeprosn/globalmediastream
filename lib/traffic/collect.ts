/**
 * Collecte KPI trafic : clients SRS (IP, alive → démarrage), débits,
 * pipelines systemd (ActiveEnterTimestamp), viewers HLS (logs nginx).
 */

import { readFile } from "fs/promises"
import { countryForIp } from "@/lib/geo-lookup"
import { collectHlsViewerDetails } from "@/lib/monitoring/collectors"
import { getSrtStreamsRegistryPath } from "@/lib/paths"
import {
  systemctlIsActive,
  systemctlShowValue,
  toSafeServiceUnit,
} from "@/lib/safe-shell"
import { collectExternalTvPoints, EXTERNAL_TV_POINTS } from "@/lib/traffic/srt-relay"
import { normalizeClientIp } from "@/lib/normalize-ip"
import { parseSystemdTimestamp } from "@/lib/systemd-uptime"
import type {
  TrafficConnection,
  TrafficHlsBucket,
  TrafficPipeline,
  TrafficReport,
  TrafficStream,
  TrafficSummary,
} from "@/lib/traffic/types"

const SRS_BASE = "http://127.0.0.1:1985"
const RTMP_STREAMS_FILE = process.env.RTMP_STREAMS_REGISTRY_PATH || "/srv/rtmp-streams.json"

type SrsClientRaw = {
  id?: string
  cid?: string
  vhost?: string
  stream?: string
  name?: string
  app?: string
  ip?: string
  pageUrl?: string
  tcUrl?: string
  url?: string
  type?: string
  publish?: boolean
  alive?: number
  kbps?: { recv_30s?: number; send_30s?: number }
}

type SrsStreamRaw = {
  id?: string
  name?: string
  app?: string
  url?: string
  clients?: number
  live_ms?: number
  send_bytes?: number
  recv_bytes?: number
  kbps?: { recv_30s?: number; send_30s?: number }
  publish?: { active?: boolean; cid?: string }
}

type RegistryEntry = {
  id: string
  name?: string
  service?: string
  inputPort?: number
  hlsUrl?: string
  type?: string
}

function streamKeyFromSrs(s: SrsStreamRaw): string {
  const n = (s.name || "").trim()
  if (n) return n
  const url = typeof s.url === "string" ? s.url : ""
  const parts = url.split("/").filter(Boolean)
  return parts[parts.length - 1] || ""
}

function appFromClientUrl(url?: string): string {
  const clean = (url || "").replace(/^\//, "")
  if (!clean) return ""
  return clean.split("/")[0] || ""
}

function streamLabel(app?: string, stream?: string): string {
  if (stream === "toubatv") return "ToubaTV"
  if (stream === "external-tv") return "External TV"
  if (stream === "external-tv-2") return "External TV 2"
  if (stream === "external-tv-3") return "External TV 3"
  if (app && stream) return `${app}/${stream}`
  return stream || app || "unknown"
}

function inferProtocol(clientType: string, tcUrl: string): string {
  const t = (clientType || "").toLowerCase()
  const u = (tcUrl || "").toLowerCase()
  if (u.startsWith("srt://") || t.includes("srt")) return "SRT"
  if (u.startsWith("rtmp://") || t.includes("rtmp") || t.includes("fmle") || t.includes("flash"))
    return "RTMP"
  if (t.includes("rtc") || t.includes("webrtc")) return "WebRTC"
  if (t.includes("hls")) return "HLS"
  if (t) return clientType
  return u ? u.split(":")[0].toUpperCase() : "—"
}

function aliveToStart(aliveSec: number, nowMs: number): { startedAt: string | null; uptimeSec: number | null } {
  if (!Number.isFinite(aliveSec) || aliveSec < 0) return { startedAt: null, uptimeSec: null }
  const uptimeSec = Math.floor(aliveSec)
  const startedAt = new Date(nowMs - uptimeSec * 1000).toISOString()
  return { startedAt, uptimeSec }
}

async function fetchSrsJson<T>(path: string, timeoutMs = 4000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${SRS_BASE}${path}`, { cache: "no-store", signal: controller.signal })
    if (!res.ok) throw new Error(`SRS HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

async function readJsonArray(path: string): Promise<RegistryEntry[]> {
  try {
    const raw = await readFile(path, "utf8")
    const data = JSON.parse(raw)
    if (Array.isArray(data)) return data as RegistryEntry[]
    if (Array.isArray(data?.streams)) return data.streams as RegistryEntry[]
    return []
  } catch {
    return []
  }
}

function normalizeClient(c: SrsClientRaw, nowMs: number, country: string | null): TrafficConnection {
  const app = (c.app || appFromClientUrl(c.url) || "").trim()
  const stream = String(c.stream || c.name || "").trim()
  const aliveSec = Number(c.alive ?? 0) || 0
  const { startedAt, uptimeSec } = aliveToStart(aliveSec, nowMs)
  const clientType = String(c.type || "")
  const tcUrl = String(c.tcUrl || "")
  const publish = Boolean(c.publish)
  return {
    cid: String(c.id || c.cid || ""),
    role: publish ? "publisher" : "player",
    app,
    stream,
    streamKey: stream || "-",
    ip: normalizeClientIp(String(c.ip || "")),
    country,
    clientType,
    protocol: inferProtocol(clientType, tcUrl),
    startedAt,
    uptimeSec,
    aliveSec,
    bwInKbps: Number(c.kbps?.recv_30s || 0),
    bwOutKbps: Number(c.kbps?.send_30s || 0),
    tcUrl,
    url: String(c.url || ""),
  }
}

const BUILTIN_PIPELINES: Array<RegistryEntry & { type: "srt" | "rtmp" }> = [
  {
    id: "toubatv",
    name: "Touba TV",
    service: "toubatv.service",
    inputPort: 6000,
    hlsUrl: "https://stream.broadcastsn.com/toubatv/index.m3u8",
    type: "srt",
  },
  {
    id: "external-tv",
    name: "External TV",
    service: "external-tv.service",
    inputPort: 6001,
    hlsUrl: "https://stream.broadcastsn.com/external-tv/index.m3u8",
    type: "srt",
  },
  {
    id: "external-tv-2",
    name: "External TV 2",
    service: "external-tv-2.service",
    inputPort: 6003,
    hlsUrl: "https://stream.broadcastsn.com/external-tv-2/index.m3u8",
    type: "srt",
  },
  {
    id: "external-tv-3",
    name: "External TV 3",
    service: "external-tv-3.service",
    inputPort: 6005,
    hlsUrl: "https://stream.broadcastsn.com/external-tv-3/index.m3u8",
    type: "srt",
  },
  {
    id: "rtmp-ttv",
    name: "TTV RTMP→HLS",
    service: "rtmp-ttv.service",
    type: "rtmp",
  },
  {
    id: "toubatv-rtmp-push",
    name: "ToubaTV HLS→RTMP push",
    service: "toubatv-rtmp-push.service",
    type: "rtmp",
  },
]

async function collectPipelines(): Promise<TrafficPipeline[]> {
  const [srt, rtmp] = await Promise.all([
    readJsonArray(getSrtStreamsRegistryPath()),
    readJsonArray(RTMP_STREAMS_FILE),
  ])

  const seen = new Set(BUILTIN_PIPELINES.map((e) => e.id))
  const entries: Array<RegistryEntry & { type: "srt" | "rtmp" }> = [
    ...BUILTIN_PIPELINES,
    ...srt
      .filter((e) => e?.id && !seen.has(e.id))
      .map((e) => ({ ...e, type: "srt" as const })),
    ...rtmp
      .filter((e) => e?.id && !seen.has(e.id))
      .map((e) => ({ ...e, type: "rtmp" as const })),
  ]

  const out: TrafficPipeline[] = []
  for (const e of entries) {
    if (!e?.id || !e.service) continue
    let status: "active" | "inactive" = "inactive"
    let startedAt: string | null = null
    let uptimeSec: number | null = null
    try {
      const unit = toSafeServiceUnit(e.service)
      const active = (await systemctlIsActive(unit)).trim()
      status = active === "active" ? "active" : "inactive"
      if (status === "active") {
        const ts = await systemctlShowValue(unit, "ActiveEnterTimestamp")
        const parsed = parseSystemdTimestamp(ts)
        startedAt = parsed.startedAt
        uptimeSec = parsed.uptimeSec
      }
    } catch {
      /* unité absente ou invalide */
    }
    out.push({
      id: e.id,
      name: e.name || e.id,
      type: e.type,
      service: e.service,
      status,
      startedAt,
      uptimeSec,
      inputPort: typeof e.inputPort === "number" ? e.inputPort : null,
      hlsUrl: e.hlsUrl || null,
    })
  }
  return out
}

async function collectHls(streamIds: string[]): Promise<TrafficHlsBucket[]> {
  if (streamIds.length === 0) return []
  try {
    const map = await collectHlsViewerDetails(streamIds)
    return [...map.entries()].map(([streamId, d]) => ({
      streamId,
      viewers: d.viewers,
      viewerCountries: d.viewerCountries,
      viewerIps: d.viewerIps,
    }))
  } catch {
    return []
  }
}

export async function collectTrafficReport(): Promise<TrafficReport> {
  const generatedAt = new Date().toISOString()
  const nowMs = Date.now()

  let srsReachable = false
  let srsError: string | undefined
  let rawStreams: SrsStreamRaw[] = []
  let rawClients: SrsClientRaw[] = []

  try {
    const [streamsRes, clientsRes] = await Promise.all([
      fetchSrsJson<{ streams?: SrsStreamRaw[] }>("/api/v1/streams/?count=1000&start=0"),
      fetchSrsJson<{ clients?: SrsClientRaw[] }>("/api/v1/clients/?count=1000&start=0"),
    ])
    rawStreams = streamsRes.streams || []
    rawClients = clientsRes.clients || []
    srsReachable = true
  } catch (e: unknown) {
    srsError = e instanceof Error ? e.message : String(e)
  }

  const uniqueIps = [
    ...new Set(
      rawClients
        .map((c) => normalizeClientIp(String(c.ip || "")))
        .filter(Boolean)
    ),
  ]
  const countryByIp = new Map<string, string | null>()
  await Promise.all(
    uniqueIps.map(async (ip) => {
      countryByIp.set(ip, await countryForIp(ip))
    })
  )

  const connections = rawClients.map((c) =>
    normalizeClient(c, nowMs, countryByIp.get(normalizeClientIp(String(c.ip || ""))) ?? null)
  )

  const byKey = new Map<string, TrafficConnection[]>()
  for (const c of connections) {
    const key = `${c.app}/${c.stream}`
    const list = byKey.get(key) || []
    list.push(c)
    byKey.set(key, list)
  }

  const streams: TrafficStream[] = rawStreams.map((s) => {
    const stream = streamKeyFromSrs(s)
    const app = s.app || ""
    const key = `${app}/${stream}`
    const clients = byKey.get(key) || []
    const publishers = clients.filter((c) => c.role === "publisher")
    const players = clients.filter((c) => c.role === "player")
    const publisher = publishers[0] || null
    const publishActive = Boolean(s.publish?.active) || publishers.length > 0

    let startedAt = publisher?.startedAt ?? null
    let uptimeSec = publisher?.uptimeSec ?? null
    // Fallback: live_ms SRS (epoch ms sur certaines builds)
    if (!startedAt && typeof s.live_ms === "number" && s.live_ms > 1_000_000_000_000) {
      startedAt = new Date(s.live_ms).toISOString()
      uptimeSec = Math.max(0, Math.floor((nowMs - s.live_ms) / 1000))
    } else if (!startedAt && typeof s.live_ms === "number" && s.live_ms > 0 && s.live_ms < 1e9) {
      // certaines builds exposent une durée en ms
      uptimeSec = Math.floor(s.live_ms / 1000)
      startedAt = new Date(nowMs - s.live_ms).toISOString()
    }

    const playerIps = new Set(players.map((p) => p.ip).filter(Boolean))

    return {
      key,
      app,
      stream,
      label: streamLabel(app, stream),
      publishActive,
      startedAt,
      uptimeSec,
      publisher,
      players,
      nclients: clients.length || Number(s.clients || 0),
      nPublishers: publishers.length,
      nPlayers: players.length,
      bwInKbps: Number(s.kbps?.recv_30s || 0),
      bwOutKbps: Number(s.kbps?.send_30s || 0),
      uniquePlayerIps: playerIps.size,
    }
  })

  // Streams présents côté clients mais absents de /streams/
  for (const [key, clients] of byKey) {
    if (streams.some((s) => s.key === key)) continue
    const [app, stream] = key.split("/")
    const publishers = clients.filter((c) => c.role === "publisher")
    const players = clients.filter((c) => c.role === "player")
    const publisher = publishers[0] || null
    streams.push({
      key,
      app: app || "",
      stream: stream || "",
      label: streamLabel(app, stream),
      publishActive: publishers.length > 0,
      startedAt: publisher?.startedAt ?? null,
      uptimeSec: publisher?.uptimeSec ?? null,
      publisher,
      players,
      nclients: clients.length,
      nPublishers: publishers.length,
      nPlayers: players.length,
      bwInKbps: publisher?.bwInKbps || 0,
      bwOutKbps: players.reduce((a, p) => a + p.bwOutKbps, 0),
      uniquePlayerIps: new Set(players.map((p) => p.ip).filter(Boolean)).size,
    })
  }

  streams.sort((a, b) => {
    if (a.publishActive !== b.publishActive) return a.publishActive ? -1 : 1
    return b.nclients - a.nclients || a.label.localeCompare(b.label)
  })

  const pipelines = await collectPipelines()

  const serviceActiveById = new Map(
    pipelines.map((p) => [p.id, p.status === "active"] as const)
  )
  const externalTv = await collectExternalTvPoints(serviceActiveById)

  const hlsIds = [
    ...new Set([
      ...streams.map((s) => s.stream).filter(Boolean),
      ...pipelines.map((p) => p.id),
      "toubatv",
      "external-tv",
      "external-tv-2",
      "external-tv-3",
    ]),
  ]
  const hlsFinal = await collectHls(hlsIds)

  const publishers = connections.filter((c) => c.role === "publisher").length
  const players = connections.filter((c) => c.role === "player").length
  const allIps = new Set(connections.map((c) => c.ip).filter(Boolean))
  for (const h of hlsFinal) {
    for (const ip of h.viewerIps) allIps.add(ip)
  }
  for (const ext of externalTv) {
    for (const peer of ext.publisherIps) allIps.add(peer.ip)
  }

  const externalRecvKbps = externalTv.reduce((a, e) => a + e.recvKbps, 0)
  const externalSendKbps = externalTv.reduce((a, e) => a + e.sendKbps, 0)

  /**
   * Décision produit (LOT 10 / C8) : un External TV aussi republished côté SRS
   * compte 1 fois dans streamsLive / bw* (priorité ingest External TV).
   */
  const extIds = new Set<string>(EXTERNAL_TV_POINTS.map((p) => p.id))
  const extLiveIds = new Set<string>(externalTv.filter((e) => e.signalLive).map((e) => e.id))
  const isSrsDupOfExternal = (streamName: string) =>
    Boolean(streamName) && extIds.has(streamName) && extLiveIds.has(streamName)

  const srsForSummary = streams.filter((s) => !isSrsDupOfExternal(s.stream))
  const srsForBw = streams.filter((s) => !isSrsDupOfExternal(s.stream))

  const summary: TrafficSummary = {
    publishers,
    players,
    uniqueIps: allIps.size,
    streamsLive:
      srsForSummary.filter((s) => s.publishActive).length +
      externalTv.filter((e) => e.signalLive).length,
    streamsTotal: srsForSummary.length + externalTv.length,
    bwInKbps: srsForBw.reduce((a, s) => a + s.bwInKbps, 0) + externalRecvKbps,
    bwOutKbps: srsForBw.reduce((a, s) => a + s.bwOutKbps, 0) + externalSendKbps,
    pipelinesActive: pipelines.filter((p) => p.status === "active").length,
    hlsViewersApprox: hlsFinal.reduce((a, h) => a + h.viewers, 0),
    externalTvLive: externalTv.filter((e) => e.signalLive).length,
  }

  return {
    ok: srsReachable || pipelines.length > 0 || externalTv.length > 0,
    generatedAt,
    srsReachable,
    srsError,
    summary,
    streams,
    connections: connections.sort((a, b) => {
      if (a.role !== b.role) return a.role === "publisher" ? -1 : 1
      return (b.uptimeSec || 0) - (a.uptimeSec || 0)
    }),
    pipelines,
    hlsViewers: hlsFinal.filter((h) => h.viewers > 0).sort((a, b) => b.viewers - a.viewers),
    externalTv,
  }
}
