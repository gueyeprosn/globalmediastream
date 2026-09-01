import { NextRequest, NextResponse } from "next/server"
import os from "node:os"
import { RECORDINGS_DIR } from "@/lib/recordings-path"
import { getCpuUsageFromProc, getDiskMetricsViaDf } from "@/lib/host-metrics"
import { requireAuth } from '@/lib/require-auth'

export const runtime = "nodejs"

export async function GET(request: NextRequest){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
    const [cpuPercent, disk] = await Promise.all([
      getCpuUsageFromProc(100),
      getDiskMetricsViaDf(RECORDINGS_DIR),
    ])

    const memTotalGb = os.totalmem() / 1024 ** 3
    const memUsedGb = (os.totalmem() - os.freemem()) / 1024 ** 3

    return NextResponse.json(
      {
        cpu_percent: Number(cpuPercent.toFixed(1)),
        mem_used_gb: Number(memUsedGb.toFixed(1)),
        mem_total_gb: Number(memTotalGb.toFixed(1)),
        disk_used_gb: disk.used,
        disk_free_gb: disk.free,
        disk_total_gb: disk.total,
        disk_percent: disk.percentage,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return NextResponse.json({ error: "system stats unavailable" }, { status: 503 })
  }
}
