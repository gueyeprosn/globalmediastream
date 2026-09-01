import { NextRequest, NextResponse } from "next/server"
import { assertSafeSystemdUnit, journalctlUnitLogs } from "@/lib/safe-shell"
import { requireAuth } from '@/lib/require-auth'

const ALLOWED_SOURCES = [
  "toubatv",
  "external-tv",
  "external-tv-2",
  "external-tv-3",
  "icecast2",
  "nginx",
]

function inferLevel(message: string): "info" | "warning" | "error" {
  const m = message.toLowerCase()
  if (m.includes("error") || m.includes("failed") || m.includes("err")) return "error"
  if (m.includes("warn") || m.includes("warning")) return "warning"
  return "info"
}

export async function GET(request: NextRequest){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
    const { searchParams } = new URL(request.url)
    const source = searchParams.get("source") || "toubatv"
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500)
    const since = searchParams.get("since") || undefined
    const grepRaw = searchParams.get("grep") || undefined
    const levelFilter = searchParams.get("level") || "all"
    const grep =
      grepRaw && /^[a-zA-Z0-9 _./:-]{1,80}$/.test(grepRaw) ? grepRaw : undefined
    const serviceName = source.includes(".service") ? source : `${source}.service`

    const isRtmp = /^rtmp-[a-z0-9-]+$/.test(source) && source.length <= 64
    const isAllowed = ALLOWED_SOURCES.includes(source) || isRtmp
    if (!isAllowed) {
      return NextResponse.json(
        { error: `Source non autorisée. Autorisés: ${ALLOWED_SOURCES.join(", ")}, rtmp-*` },
        { status: 400 }
      )
    }

    let unit: string
    try {
      unit = assertSafeSystemdUnit(serviceName)
    } catch {
      return NextResponse.json({ error: "Source ou unité invalide" }, { status: 400 })
    }

    const stdout = await journalctlUnitLogs(unit, limit, true, { since, grep })

    const lines = stdout.trim().split("\n").filter((line) => line.trim())
    const entries = lines
      .map((line, index) => {
      const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.+-]+)\s+\S+\s+(.*)$/)
      const timestamp = match ? new Date(match[1]).getTime() : Date.now() - index * 1000
      const message = match ? match[2].trim() : line
      return {
        id: `${source}-${timestamp}-${index}`,
        timestamp,
        level: inferLevel(message),
        message,
        streamId: source,
        source,
      }
    })
      .filter((entry) => levelFilter === "all" || entry.level === levelFilter)

    return NextResponse.json(
      { logs: entries },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur lors de la récupération des logs"
    return NextResponse.json({ error: message, logs: [] }, { status: 500 })
  }
}
