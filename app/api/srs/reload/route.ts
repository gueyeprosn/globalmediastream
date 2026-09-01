import { NextRequest, NextResponse } from "next/server"
import { requireRole } from '@/lib/rbac'

type SrsReloadResponse = {
  code: number
  message?: string
}

export async function POST(request: NextRequest){
  const __auth = await requireRole('srs:reload')(request)
  if (!__auth.ok) return __auth.response

  const res = await fetch(`http://127.0.0.1:1985/api/v1/raw?rpc=reload`, {
    method: "GET",
    cache: "no-store",
  })

  const body = (await res.json().catch(() => null)) as SrsReloadResponse | null

  if (!res.ok) {
    return NextResponse.json(
      { error: body?.message || `SRS HTTP ${res.status}` },
      { status: res.status }
    )
  }

  return NextResponse.json(body || { code: 0 })
}

