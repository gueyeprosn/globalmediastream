import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from '@/lib/require-auth'

export const runtime = "nodejs"

type SrsStream = {
  id?: string
  name?: string
  app?: string
  /** ex. `/live/toubatv` si `name` est vide selon la config SRS */
  url?: string
  kbps?: { recv_30s?: number; send_30s?: number }
  publish?: { active?: boolean; cid?: string }
  vhost?: string
  clients?: number
}

function streamKeyFromSrs(s: SrsStream): string {
  const n = (s.name || "").trim()
  if (n) return n
  const url = typeof s.url === "string" ? s.url : ""
  const parts = url.split("/").filter(Boolean)
  return parts[parts.length - 1] || ""
}

type SrsStat = {
  cid?: string
  stream?: string
  app?: string
  clients?: number
  nb_clients?: number
  publish?: { active?: boolean }
  video?: { width?: number; height?: number; fps?: number; codec?: string }
}

function streamLabel(app?: string, stream?: string) {
  if (app === "dakar" && stream) return stream
  if (app === "live" && stream) return stream
  if (stream === "toubatv") return "ToubaTV"
  if (stream === "external-tv") return "External TV"
  if (stream === "external-tv-2") return "External TV 2"
  if (stream === "external-tv-3") return "External TV 3"
  return stream || app || "unknown"
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 3000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(request: NextRequest){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
    const [streamsRes, statsRes] = await Promise.all([
      fetchJsonWithTimeout("http://127.0.0.1:1985/api/v1/streams/"),
      fetchJsonWithTimeout("http://127.0.0.1:1985/api/v1/clients/"),
    ])

    const streams: SrsStream[] = streamsRes?.streams || []
    const clients: Array<{
      app?: string
      stream?: string
      name?: string
      url?: string
      publish?: boolean
      alive?: number
      ip?: string
    }> = statsRes?.clients || []
    const clientCountByStream = new Map<string, number>()
    const publisherAliveByStream = new Map<string, number>()
    for (const c of clients) {
      const app = c.app || (typeof c.url === "string" ? c.url.replace(/^\//, "").split("/")[0] : "") || ""
      const stream = c.stream || c.name || ""
      const key = `${app}/${stream}`
      clientCountByStream.set(key, (clientCountByStream.get(key) || 0) + 1)
      if (c.publish === true) {
        const alive = Number(c.alive || 0)
        const prev = publisherAliveByStream.get(key) || 0
        if (alive > prev) publisherAliveByStream.set(key, alive)
      }
    }

    const mergedStreams = streams.map((s) => {
      const streamKey = streamKeyFromSrs(s)
      const key = `${s.app || ""}/${streamKey}`
      const publishActive = Boolean(s.publish?.active)
      const aliveSec = publisherAliveByStream.get(key) || 0
      return {
        name: streamLabel(s.app, streamKey),
        app: s.app || "",
        stream: streamKey,
        bw_in_kbps: Number(s.kbps?.recv_30s || 0),
        bw_out_kbps: Number(s.kbps?.send_30s || 0),
        /** Présence d’un publisher SRS (souvent vrai alors que recv_30s est encore 0) */
        publishActive,
        nclients: Number(clientCountByStream.get(key) ?? s.clients ?? 0),
        publish_duration_ms: Math.floor(aliveSec * 1000),
        video: {
          width: 0,
          height: 0,
          fps: 0,
          codec: "",
        },
      }
    })

    const global = {
      recv_bytes: mergedStreams.reduce((a, s) => a + s.bw_in_kbps * 1024, 0),
      send_bytes: mergedStreams.reduce((a, s) => a + s.bw_out_kbps * 1024, 0),
      nb_streams: mergedStreams.length,
      nb_clients: mergedStreams.reduce((a, s) => a + s.nclients, 0),
    }

    return NextResponse.json({ streams: mergedStreams, global, ok: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (error: any) {
    const message = String(error?.message || error || "")
    if (message.includes("ECONNREFUSED") || message.includes("fetch failed") || message.includes("aborted")) {
      return NextResponse.json({ ok: false, error: "SRS unreachable" }, { status: 503 })
    }
    return NextResponse.json({ ok: false, error: "SRS stats error" }, { status: 503 })
  }
}

