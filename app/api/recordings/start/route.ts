import { NextRequest, NextResponse } from "next/server"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"
import { resolveHlsUrlForRecording } from "@/lib/recordings-hls-sources"
import { gateRecordingsDiskSpace } from "@/lib/recordings-disk"
import { recordingStartBodySchema } from "@/lib/schemas/recordings"
import { zodErrorResponse } from "@/lib/zod-response"
import { requireAuth } from '@/lib/require-auth'
import { isAlive } from '@/lib/process-kill'

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
    if (!parsed?.active) return { active: {} }
    // Réconciliation : purge les entrées dont le PID n'existe plus (crash
    // serveur, ffmpeg tué hors de l'app) pour ne pas bloquer un futur "start"
    // sur un enregistrement qu'on croit encore actif.
    for (const [streamId, rec] of Object.entries(parsed.active)) {
      if (!isAlive(rec.pid)) delete parsed.active[streamId]
    }
    return parsed
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

function spawnFfmpegDetached(args: string[]): Promise<{ pid: number; child: ReturnType<typeof spawn> }> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: "ignore", detached: true })
    let settled = false

    const fail = (err: Error) => {
      if (settled) return
      settled = true
      try {
        child.kill("SIGTERM")
      } catch {
        /* ignore */
      }
      reject(err)
    }

    child.once("error", (err) => {
      const msg =
        err && typeof err === "object" && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT"
          ? "ffmpeg introuvable sur le serveur"
          : err instanceof Error
            ? err.message
            : "échec spawn ffmpeg"
      fail(new Error(msg))
    })

    child.once("spawn", () => {
      if (settled) return
      const pid = child.pid
      if (pid == null || pid < 0) {
        fail(new Error("ffmpeg spawn: pid manquant"))
        return
      }
      settled = true
      resolve({ pid, child })
    })
  })
}

export async function POST(request: NextRequest){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  const raw = await request.json().catch(() => null)
  const parsed = recordingStartBodySchema.safeParse(raw)
  if (!parsed.success) {
    return zodErrorResponse(parsed.error)
  }
  const { streamId } = parsed.data

  const diskGate = await gateRecordingsDiskSpace(RECORDINGS_DIR)
  if (!diskGate.ok) {
    return NextResponse.json(
      {
        error: diskGate.error,
        disk: diskGate.stats
          ? {
              usedPercent: diskGate.stats.usedPercent,
              freePercent: diskGate.stats.freePercent,
              freeGb: diskGate.stats.freeGb,
              totalGb: diskGate.stats.totalGb,
              mount: diskGate.stats.mount,
              minFreePercent: diskGate.minFreePercent,
            }
          : null,
      },
      { status: 507 }
    )
  }

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

  let pid: number
  let child: ReturnType<typeof spawn>
  try {
    ;({ pid, child } = await spawnFfmpegDetached(args))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "échec démarrage ffmpeg"
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  child.once("exit", (code) => {
    if (code === 0 || code === null) return
    void (async () => {
      try {
        const st = await loadState()
        const cur = st.active[streamId]
        if (cur && cur.pid === pid) {
          delete st.active[streamId]
          await saveState(st)
        }
      } catch {
        /* ignore */
      }
    })()
  })

  child.unref()

  state.active[streamId] = {
    streamId,
    pid,
    filePath: outPath,
    startedAt: Date.now(),
  }
  await saveState(state)

  return NextResponse.json({
    ok: true,
    streamId,
    file: outName,
    disk: {
      usedPercent: diskGate.stats.usedPercent,
      freePercent: diskGate.stats.freePercent,
      freeGb: diskGate.stats.freeGb,
    },
  })
}
