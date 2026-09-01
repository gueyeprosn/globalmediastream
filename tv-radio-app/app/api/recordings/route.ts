import { NextRequest, NextResponse } from "next/server"
import { readdir, stat, mkdir, readFile, writeFile } from "node:fs/promises"
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

function safeRel(p: string) {
  return p.replace(RECORDINGS_DIR, "").replace(/^\/+/, "")
}

export async function GET(request: NextRequest){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  await ensureDirs()
  const state = await loadState()

  const entries = await readdir(RECORDINGS_DIR, { withFileTypes: true })
  const files = await Promise.all(
    entries
      .filter((d) => d.isFile())
      .filter((d) => !d.name.startsWith("."))
      .map(async (d) => {
        const fp = path.join(RECORDINGS_DIR, d.name)
        const st = await stat(fp)
        return {
          id: d.name,
          name: d.name,
          sizeBytes: st.size,
          modifiedAt: st.mtimeMs,
          downloadUrl: `/api/recordings/${encodeURIComponent(d.name)}/download`,
          deleteUrl: `/api/recordings/${encodeURIComponent(d.name)}`,
        }
      })
  )

  return NextResponse.json({
    recordings: files.sort((a, b) => b.modifiedAt - a.modifiedAt),
    active: Object.values(state.active).map((r) => ({
      ...r,
      file: safeRel(r.filePath),
    })),
  })
}

