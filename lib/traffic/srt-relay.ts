/**
 * Parse les logs srt-live-transmit des points External TV (SRT→SRT).
 * Lit seulement la fin du fichier (tail) pour rester rapide sur gros logs.
 */

import { stat } from "fs/promises"
import { countryForIp } from "@/lib/geo-lookup"
import { spawnCapture } from "@/lib/safe-shell"
import type { ExternalTvPoint, ExternalTvPeer } from "@/lib/traffic/types"

export const EXTERNAL_TV_POINTS = [
  {
    id: "external-tv",
    name: "External TV",
    inputPort: 6001,
    outputPort: 6002,
    service: "external-tv.service",
    logPath: "/srv/external-tv/logs/srt-relay.log",
  },
  {
    id: "external-tv-2",
    name: "External TV 2",
    inputPort: 6003,
    outputPort: 6004,
    service: "external-tv-2.service",
    logPath: "/srv/external-tv-2/logs/srt-relay.log",
  },
  {
    id: "external-tv-3",
    name: "External TV 3",
    inputPort: 6005,
    outputPort: 6006,
    service: "external-tv-3.service",
    logPath: "/srv/external-tv-3/logs/srt-relay.log",
  },
] as const

const ALLOWED_LOGS: Set<string> = new Set(EXTERNAL_TV_POINTS.map((p) => p.logPath))
const TAIL_LINES = 900
const LIVE_RECV_MBPS = 0.05

const FROM_IP_RE =
  /(?:PASSING request from|connection request from):\s*(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})/gi
const RATE_RE = /RATE\s+SENDING:\s*([\d.]+)\s+RECEIVING:\s*([\d.]+)/i
const LINK_RE = /LINK\s+RTT:\s*([\d.]+)\s*ms/i
const BYTES_RE =
  /(\d+)\s+bytes lost,\s*(\d+)\s+bytes sent,\s*(\d+)\s+bytes received/i

async function tailLog(logPath: string): Promise<string> {
  if (!ALLOWED_LOGS.has(logPath)) return ""
  try {
    const { stdout } = await spawnCapture("tail", ["-n", String(TAIL_LINES), logPath], {
      timeoutMs: 5_000,
      maxBuffer: 2 * 1024 * 1024,
    })
    return stdout || ""
  } catch {
    return ""
  }
}

function parsePeers(text: string): Map<string, { port: number; hits: number }> {
  const map = new Map<string, { port: number; hits: number }>()
  FROM_IP_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = FROM_IP_RE.exec(text)) !== null) {
    const ip = m[1]
    const port = Number(m[2]) || 0
    const prev = map.get(ip)
    if (prev) {
      prev.hits += 1
      prev.port = port
    } else {
      map.set(ip, { port, hits: 1 })
    }
  }
  return map
}

function lastMatch(text: string, re: RegExp): RegExpExecArray | null {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`
  const global = new RegExp(re.source, flags)
  let last: RegExpExecArray | null = null
  let m: RegExpExecArray | null
  while ((m = global.exec(text)) !== null) last = m
  return last
}

function countOccurrences(text: string, needle: string): number {
  if (!needle) return 0
  let n = 0
  let i = 0
  while ((i = text.indexOf(needle, i)) !== -1) {
    n++
    i += needle.length
  }
  return n
}

export function parseSrtRelayLogTail(text: string): {
  recvMbps: number
  sendMbps: number
  rttMs: number | null
  bytesLost: number | null
  bytesSent: number | null
  bytesReceived: number | null
  peers: Map<string, { port: number; hits: number }>
  sourceAccepted: number
  sourceDisconnected: number
  targetAccepted: number
  targetDisconnected: number
} {
  const rate = lastMatch(text, RATE_RE)
  const link = lastMatch(text, LINK_RE)
  const bytes = lastMatch(text, BYTES_RE)
  return {
    recvMbps: rate ? Number(rate[2]) || 0 : 0,
    sendMbps: rate ? Number(rate[1]) || 0 : 0,
    rttMs: link ? Number(link[1]) || null : null,
    bytesLost: bytes ? Number(bytes[1]) : null,
    bytesSent: bytes ? Number(bytes[2]) : null,
    bytesReceived: bytes ? Number(bytes[3]) : null,
    peers: parsePeers(text),
    sourceAccepted: countOccurrences(text, "Accepted SRT source connection"),
    sourceDisconnected: countOccurrences(text, "SRT source disconnected"),
    targetAccepted: countOccurrences(text, "Accepted SRT target connection"),
    targetDisconnected: countOccurrences(text, "SRT target disconnected"),
  }
}

async function enrichPeers(
  peers: Map<string, { port: number; hits: number }>
): Promise<ExternalTvPeer[]> {
  const list = [...peers.entries()]
    .map(([ip, v]) => ({ ip, port: v.port, hits: v.hits }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 24)

  return Promise.all(
    list.map(async (p) => ({
      ip: p.ip,
      port: p.port,
      hits: p.hits,
      country: await countryForIp(p.ip),
    }))
  )
}

export async function collectExternalTvPoints(
  serviceActiveById: Map<string, boolean>
): Promise<ExternalTvPoint[]> {
  const out: ExternalTvPoint[] = []

  for (const def of EXTERNAL_TV_POINTS) {
    let logMtime: string | null = null
    try {
      const st = await stat(def.logPath)
      logMtime = st.mtime.toISOString()
    } catch {
      /* log absent */
    }

    const text = await tailLog(def.logPath)
    const parsed = parseSrtRelayLogTail(text)
    const peerList = await enrichPeers(parsed.peers)

    const serviceActive = serviceActiveById.get(def.id) === true
    const signalLive = serviceActive && parsed.recvMbps >= LIVE_RECV_MBPS

    let lossPct: number | null = null
    if (
      parsed.bytesReceived != null &&
      parsed.bytesLost != null &&
      parsed.bytesReceived + parsed.bytesLost > 0
    ) {
      lossPct =
        (100 * parsed.bytesLost) / (parsed.bytesReceived + parsed.bytesLost)
    }

    // Connexion cible récente dans le tail : plus d’accepts que de disconnects
    // ou dernier événement = accepted (approximation)
    const targetNet = parsed.targetAccepted - parsed.targetDisconnected
    const targetConnected = parsed.sendMbps > LIVE_RECV_MBPS ? true : targetNet > 0 ? true : false

    out.push({
      id: def.id,
      name: def.name,
      inputPort: def.inputPort,
      outputPort: def.outputPort,
      service: def.service,
      serviceActive,
      signalLive,
      recvMbps: Number(parsed.recvMbps.toFixed(3)),
      sendMbps: Number(parsed.sendMbps.toFixed(3)),
      recvKbps: Math.round(parsed.recvMbps * 1000),
      sendKbps: Math.round(parsed.sendMbps * 1000),
      rttMs: parsed.rttMs,
      bytesReceived: parsed.bytesReceived,
      bytesSent: parsed.bytesSent,
      bytesLost: parsed.bytesLost,
      lossPct: lossPct != null ? Number(lossPct.toFixed(2)) : null,
      publisherIps: peerList,
      targetConnected: signalLive ? targetConnected : false,
      logPath: def.logPath,
      logMtime,
    })
  }

  return out
}
