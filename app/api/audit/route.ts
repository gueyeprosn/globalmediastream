import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from '@/lib/require-auth'
import { queryAuditLog } from '@/lib/audit-db'

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50), 500)
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0)
  const userSub = searchParams.get("user") || undefined
  const action = searchParams.get("action") || undefined
  const since = searchParams.get("since") || undefined

  const { rows, total } = queryAuditLog({ limit, offset, userSub, action, since })

  return NextResponse.json({ rows, total, limit, offset })
}
