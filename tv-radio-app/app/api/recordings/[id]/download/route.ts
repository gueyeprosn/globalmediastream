import { NextRequest, NextResponse } from "next/server"
import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { parseSafeRecordingFilename, recordingAbsPath } from "@/lib/recordings-path"
import { requireAuth } from '@/lib/require-auth'

export const runtime = "nodejs"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  const { id } = await context.params
  const safe = parseSafeRecordingFilename(id)
  if (!safe) {
    return NextResponse.json({ error: "Nom de fichier invalide" }, { status: 400 })
  }
  const filePath = recordingAbsPath(safe)

  try {
    const st = await stat(filePath)
    if (!st.isFile()) throw new Error("not file")
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 })
  }

  const stream = createReadStream(filePath)
  return new NextResponse(stream as any, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename=\"${safe}\"`,
    },
  })
}

