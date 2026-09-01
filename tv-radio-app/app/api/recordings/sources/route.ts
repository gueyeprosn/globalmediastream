import { NextRequest, NextResponse } from "next/server"
import { listRecordableHlsSources } from "@/lib/recordings-hls-sources"
import { requireAuth } from '@/lib/require-auth'

export const runtime = "nodejs"

/** Liste des flux pour lesquels un enregistrement HLS → MKV (-c copy) est possible. */
export async function GET(request: NextRequest){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
    const sources = await listRecordableHlsSources()
    return NextResponse.json(
      { sources },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
