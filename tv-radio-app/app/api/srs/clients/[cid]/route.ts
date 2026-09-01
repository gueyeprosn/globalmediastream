import { NextRequest, NextResponse } from "next/server"
import { logInfo, logWarn } from "@/lib/logger"
import { requireAuth } from '@/lib/require-auth'

type SrsDeleteResponse = {
  code: number
  message?: string
}

const CID_RE = /^[A-Za-z0-9._:-]{1,128}$/
const SRS_KICK_TIMEOUT_MS = 3_000

export async function DELETE(request: NextRequest,
  context: { params: Promise<{ cid: string }> }){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  const { cid: rawCid } = await context.params
  const cid = typeof rawCid === "string" ? rawCid.trim() : ""

  if (!cid || !CID_RE.test(cid)) {
    logWarn(request, "srs/kick", "cid invalide", { action: "srs_kick", result: "rejected" })
    return NextResponse.json({ error: "Client id invalide" }, { status: 400 })
  }

  let res: Response
  try {
    res = await fetch(`http://127.0.0.1:1985/api/v1/clients/${encodeURIComponent(cid)}`, {
      method: "DELETE",
      cache: "no-store",
      signal: AbortSignal.timeout(SRS_KICK_TIMEOUT_MS),
    })
  } catch (e: unknown) {
    const name = e instanceof Error ? e.name : ""
    const timedOut = name === "TimeoutError" || name === "AbortError"
    logWarn(request, "srs/kick", timedOut ? "timeout SRS" : "SRS indisponible", {
      action: "srs_kick",
      cid,
      result: timedOut ? "timeout" : "unreachable",
    })
    return NextResponse.json(
      { error: timedOut ? "SRS timeout" : "SRS indisponible" },
      { status: timedOut ? 504 : 502 }
    )
  }

  const body = (await res.json().catch(() => null)) as SrsDeleteResponse | null

  if (!res.ok) {
    logWarn(request, "srs/kick", "échec kick", {
      action: "srs_kick",
      cid,
      result: "error",
      httpStatus: res.status,
    })
    return NextResponse.json(
      { error: res.status >= 500 ? "Erreur SRS" : "Kick refusé" },
      { status: res.status >= 500 ? 502 : res.status }
    )
  }

  logInfo(request, "srs/kick", "publisher expulsé", {
    action: "srs_kick",
    cid,
    result: "success",
  })

  return NextResponse.json(body || { code: 0 })
}
