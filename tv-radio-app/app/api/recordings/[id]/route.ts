import { NextRequest, NextResponse } from "next/server"
import { unlink, mkdir, rename, stat } from "node:fs/promises"
import { parseSafeRecordingFilename, recordingAbsPath, RECORDINGS_DIR } from "@/lib/recordings-path"
import { recordingRenameBodySchema } from "@/lib/schemas/recordings"
import { zodErrorResponse } from "@/lib/zod-response"
import { logInfo, logWarn } from "@/lib/logger"
import { requireRole } from '@/lib/rbac'
import { withAudit } from '@/lib/audit'

export const runtime = "nodejs"

async function patchHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const __auth = await requireRole('recording:stop')(request)
  if (!__auth.ok) return __auth.response

  const { id } = await context.params
  const safeOld = parseSafeRecordingFilename(id)
  if (!safeOld) {
    return NextResponse.json({ error: "Nom de fichier source invalide" }, { status: 400 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = recordingRenameBodySchema.safeParse(raw)
  if (!parsed.success) {
    return zodErrorResponse(parsed.error)
  }
  const { newName } = parsed.data

  await mkdir(RECORDINGS_DIR, { recursive: true })
  const fromPath = recordingAbsPath(safeOld)
  const toPath = recordingAbsPath(newName)
  if (fromPath === toPath) {
    return NextResponse.json({ ok: true, id: newName })
  }

  try {
    await stat(toPath)
    return NextResponse.json({ error: "Un fichier avec ce nom existe déjà" }, { status: 409 })
  } catch {
    /* fichier absent : OK */
  }

  try {
    await rename(fromPath, toPath)
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException)?.code
    if (code === "ENOENT") {
      return NextResponse.json({ error: "Fichier source introuvable" }, { status: 404 })
    }
    return NextResponse.json({ error: "Renommage impossible" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: newName })
}

export const PATCH = withAudit('recording:stop', patchHandler)

async function deleteHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const __auth = await requireRole('recording:delete')(request)
  if (!__auth.ok) return __auth.response

  const { id } = await context.params
  const safe = parseSafeRecordingFilename(id)
  if (!safe) {
    logWarn(request, "recordings/delete", "nom invalide", {
      action: "recording_delete",
      result: "rejected",
    })
    return NextResponse.json({ error: "Nom de fichier invalide" }, { status: 400 })
  }
  await mkdir(RECORDINGS_DIR, { recursive: true })
  const filePath = recordingAbsPath(safe)

  try {
    await unlink(filePath)
  } catch {
    logWarn(request, "recordings/delete", "fichier introuvable", {
      action: "recording_delete",
      file: safe,
      result: "not_found",
    })
    return NextResponse.json({ error: "Suppression impossible ou fichier introuvable" }, { status: 404 })
  }

  logInfo(request, "recordings/delete", "fichier supprimé", {
    action: "recording_delete",
    file: safe,
    result: "success",
  })

  return NextResponse.json({ ok: true })
}

export const DELETE = withAudit('recording:delete', deleteHandler)

