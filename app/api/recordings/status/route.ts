import { NextRequest, NextResponse } from "next/server"
import fs from "node:fs"
import { requireAuth } from '@/lib/require-auth'

export const runtime = "nodejs"

const STATE_FILE = "/srv/recordings/.recordings-state.json"

export async function GET(request: NextRequest){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8")
    const parsed = JSON.parse(raw) as { active?: Record<string, { pid?: number }> }
    const active = parsed?.active || {}

    const cleanedActive = Object.fromEntries(
      Object.entries(active).filter(([, rec]) => {
        const pid = Number(rec?.pid || 0)
        if (pid <= 0) return false
        try {
          process.kill(pid, 0)
          return true
        } catch {
          return false
        }
      })
    )

    if (Object.keys(cleanedActive).length !== Object.keys(active).length) {
      fs.writeFileSync(
        STATE_FILE,
        JSON.stringify({ ...parsed, active: cleanedActive }, null, 2),
        "utf8"
      )
    }

    return NextResponse.json({ ...parsed, active: cleanedActive })
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return NextResponse.json({})
    }
    return NextResponse.json({}, { status: 503 })
  }
}

