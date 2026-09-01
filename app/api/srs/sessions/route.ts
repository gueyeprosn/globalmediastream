import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from '@/lib/require-auth'

type SrsStreamsResponse = {
  code: number
  server?: string
  pid?: string
  service?: string
  streams?: Array<any>
}

type SrsClientsResponse = {
  code: number
  server?: string
  pid?: string
  service?: string
  clients?: Array<any>
}

async function fetchSrsJson<T>(path: string): Promise<T> {
  const res = await fetch(`http://127.0.0.1:1985${path}`, {
    method: "GET",
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`SRS HTTP ${res.status} for ${path}`)
  }

  return (await res.json()) as T
}

// Retourne à la fois les streams actifs (publish) et la liste des clients RTMP.
// But UI: afficher publishers + players et permettre un kick par client cid.
export async function GET(request: NextRequest){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  const [streamsRes, clientsRes] = await Promise.all([
    fetchSrsJson<SrsStreamsResponse>(`/api/v1/streams/?count=1000&start=0`),
    fetchSrsJson<SrsClientsResponse>(`/api/v1/clients/?count=1000&start=0`),
  ])

  return NextResponse.json({
    streams: streamsRes.streams || [],
    clients: clientsRes.clients || [],
  })
}

