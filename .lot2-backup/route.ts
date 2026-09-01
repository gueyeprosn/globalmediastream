import { NextRequest, NextResponse } from "next/server"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"
import { resolveHlsUrlForRecording } from "@/lib/recordings-hls-sources"
import { recordingStartBodySchema } from "@/lib/schemas/recordings"
import { zodErrorResponse } from "@/lib/zod-response"

export const runtime = "nodejs"

/** Sortie continue en Matroska (-c copy) : fiable sans finalisation MOOV (contrairement au MP4). */
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

function nowStamp() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null)
  const parsed = recordingStartBodySchema.safeParse(raw)
  if (!parsed.success) {
    return zodErrorResponse(parsed.error)
  }
  const { streamId } = parsed.data

  const inputUrl = await resolveHlsUrlForRecording(streamId)
  if (!inputUrl) {
    return NextResponse.json(
      {
        error:
          "Flux sans URL HLS connue (relais SRT sans HLS, Icecast, ou id inconnu). Voir GET /api/recordings/sources.",
      },
      { status: 400 }
    )
  }

  const state = await loadState()
  if (state.active[streamId]) {
    return NextResponse.json({ error: "Enregistrement déjà en cours" }, { status: 409 })
  }

  await ensureDirs()
  const outName = `${streamId}-${nowStamp()}.mkv`
  const outPath = path.join(RECORDINGS_DIR, outName)

  // mkv: robuste pour l'écriture en continu (mp4 nécessite finalisation stricte)
  const args = [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-y",
    "-i",
    inputUrl,
    "-c",
    "copy",
    "-f",
    "matroska",
    outPath,
  ]

  const child = spawn("ffmpeg", args, { stdio: "ignore", detached: true })
  child.unref()

  state.active[streamId] = {
    streamId,
    pid: child.pid ?? -1,
    filePath: outPath,
    startedAt: Date.now(),
  }
  await saveState(state)

  return NextResponse.json({ ok: true, streamId, file: outName })
}

