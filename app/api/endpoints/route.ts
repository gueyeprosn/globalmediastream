import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from '@/lib/require-auth'

export const runtime = "nodejs"

type ChannelEndpoint = {
  name: string
  protocol: "SRT" | "RTMP" | "ICECAST"
  srtPort?: number
  hlsUrl?: string
  hlsAvailable?: boolean
  ingestUrl?: string
  hlsPath?: string
}

async function headOk(url: string, timeoutMs = 3000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store", signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(request: NextRequest){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  const channels: ChannelEndpoint[] = [
    {
      name: "ToubaTV",
      protocol: "SRT",
      srtPort: 6000,
      ingestUrl: "srt://stream.broadcastsn.com:6000",
      hlsUrl: "https://stream.broadcastsn.com/toubatv/index.m3u8",
      hlsPath: "/srv/rtmp-hls/toubatv/",
    },
    {
      name: "External TV",
      protocol: "SRT",
      srtPort: 6001,
      ingestUrl: "srt://stream.broadcastsn.com:6001",
      hlsUrl: "https://stream.broadcastsn.com/external-tv/index.m3u8",
      hlsPath: "/srv/rtmp-hls/external-tv/",
    },
    {
      name: "External TV 2",
      protocol: "SRT",
      srtPort: 6003,
      ingestUrl: "srt://stream.broadcastsn.com:6003",
      hlsUrl: "https://stream.broadcastsn.com/external-tv-2/index.m3u8",
      hlsPath: "/srv/rtmp-hls/external-tv-2/",
    },
    {
      name: "External TV 3",
      protocol: "SRT",
      srtPort: 6005,
      ingestUrl: "srt://stream.broadcastsn.com:6005",
      hlsUrl: "https://stream.broadcastsn.com/external-tv-3/index.m3u8",
      hlsPath: "/srv/rtmp-hls/external-tv-3/",
    },
  ]

  await Promise.all(
    channels.map(async (c) => {
      c.hlsAvailable = c.hlsUrl ? await headOk(c.hlsUrl) : false
    })
  )

  return NextResponse.json({ channels }, { headers: { "Cache-Control": "no-store" } })
}

