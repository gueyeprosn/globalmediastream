import { NextRequest, NextResponse } from "next/server"

type SrsDeleteResponse = {
  code: number
  message?: string
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ cid: string }> }
) {
  const { cid } = await context.params

  const res = await fetch(`http://127.0.0.1:1985/api/v1/clients/${encodeURIComponent(cid)}`, {
    method: "DELETE",
    cache: "no-store",
  })

  const body = (await res.json().catch(() => null)) as SrsDeleteResponse | null

  if (!res.ok) {
    return NextResponse.json(
      { error: body?.message || `SRS HTTP ${res.status}` },
      { status: res.status }
    )
  }

  return NextResponse.json(body || { code: 0 })
}

