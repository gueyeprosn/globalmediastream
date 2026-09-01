import { NextRequest, NextResponse } from "next/server"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { requireAuth } from '@/lib/require-auth'

export const runtime = "nodejs"

const RECORDINGS_DIR = process.env.RECORDINGS_DIR || "/srv/recordings"
const STATE_FILE = path.join(RECORDINGS_DIR, ".recordings-state.json")

type ActiveRecording = {
  streamId: string
  pid: number
  filePath: string
  startedAt: number
}

type RecordingState = {
  active: Record<string, ActiveRecording>
}

async function ensureDirs() {
  await mkdir(RECORDINGS_DIR, { recursive: true })
}

async function loadState(): Promise<RecordingState> {
  await ensureDirs()
  try {
    const raw = await readFile(STATE_FILE, "utf8")
    const parsed = JSON.parse(raw) as RecordingState
    return parsed?.active ? parsed : { active: {} }
  } catch {
    return { active: {} }
  }
}

async function saveState(state: RecordingState) {
  await ensureDirs()
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8")
}

export async function POST(request: NextRequest){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  const body = (await request.json().catch(() => null)) as
    | { streamId?: string }
    | null

  const streamId = body?.streamId
  if (!streamId) {
    return NextResponse.json({ error: "streamId requis" }, { status: 400 })
  }

  const state = await loadState()
  const rec = state.active[streamId]
  if (!rec) {
    return NextResponse.json({ error: "Aucun enregistrement en cours" }, { status: 404 })
  }

  if (rec.pid > 0) {
    try {
      process.kill(rec.pid, "SIGINT")
    } catch {
      // ignore
    }
  }

  delete state.active[streamId]
  await saveState(state)

  return NextResponse.json({ ok: true })
}

