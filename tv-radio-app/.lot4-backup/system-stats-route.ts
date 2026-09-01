import { NextResponse } from "next/server"
import os from "node:os"
import { execSync } from "node:child_process"

export const runtime = "nodejs"

function cpuTimes() {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  for (const cpu of cpus) {
    idle += cpu.times.idle
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle
  }
  return { idle, total }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseDfForSrvRecordings() {
  const raw = execSync("df -BG /srv/recordings").toString("utf8").trim().split("\n")
  if (raw.length < 2) throw new Error("df parse error")
  const cols = raw[1].trim().split(/\s+/)
  const total = Number((cols[1] || "0G").replace("G", ""))
  const used = Number((cols[2] || "0G").replace("G", ""))
  const free = Number((cols[3] || "0G").replace("G", ""))
  const percent = Number((cols[4] || "0%").replace("%", ""))
  return { total, used, free, percent }
}

export async function GET() {
  try {
    const s1 = cpuTimes()
    await sleep(100)
    const s2 = cpuTimes()
    const idleDelta = s2.idle - s1.idle
    const totalDelta = s2.total - s1.total
    const cpuPercent = totalDelta > 0 ? Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100)) : 0

    const memTotalGb = os.totalmem() / (1024 ** 3)
    const memUsedGb = (os.totalmem() - os.freemem()) / (1024 ** 3)

    const disk = parseDfForSrvRecordings()

    return NextResponse.json(
      {
        cpu_percent: Number(cpuPercent.toFixed(1)),
        mem_used_gb: Number(memUsedGb.toFixed(1)),
        mem_total_gb: Number(memTotalGb.toFixed(1)),
        disk_used_gb: disk.used,
        disk_free_gb: disk.free,
        disk_total_gb: disk.total,
        disk_percent: disk.percent,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return NextResponse.json({ error: "system stats unavailable" }, { status: 503 })
  }
}

