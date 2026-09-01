import { NextRequest, NextResponse } from "next/server"
import { collectTrafficReport } from "@/lib/traffic/collect"
import { requireAuth } from '@/lib/require-auth'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
    const report = await collectTrafficReport()
    const status = report.srsReachable || report.pipelines.length > 0 ? 200 : 503
    return NextResponse.json(report, {
      status,
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "traffic error"
    return NextResponse.json(
      {
        ok: false,
        generatedAt: new Date().toISOString(),
        srsReachable: false,
        srsError: message,
        summary: {
          publishers: 0,
          players: 0,
          uniqueIps: 0,
          streamsLive: 0,
          streamsTotal: 0,
          bwInKbps: 0,
          bwOutKbps: 0,
          pipelinesActive: 0,
          hlsViewersApprox: 0,
          externalTvLive: 0,
        },
        streams: [],
        connections: [],
        pipelines: [],
        hlsViewers: [],
        externalTv: [],
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}
