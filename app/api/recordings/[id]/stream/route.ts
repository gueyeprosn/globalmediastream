import { NextRequest, NextResponse } from "next/server"
import { createReadStream } from "node:fs"
import { mkdir, stat } from "node:fs/promises"
import { parseSafeRecordingFilename, recordingAbsPath, RECORDINGS_DIR } from "@/lib/recordings-path"
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
  await mkdir(RECORDINGS_DIR, { recursive: true })

  let size: number
  try {
    const st = await stat(filePath)
    if (!st.isFile()) throw new Error("not file")
    size = st.size
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 })
  }

  const range = request.headers.get("range")
  const commonHeaders: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Content-Type": "video/x-matroska",
    "Content-Disposition": `inline; filename="${encodeURIComponent(safe)}"`,
    "Cache-Control": "private, no-store",
  }

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
    if (!m) {
      return NextResponse.json({ error: "Range invalide" }, { status: 416 })
    }
    let start = m[1] ? parseInt(m[1], 10) : 0
    let end = m[2] ? parseInt(m[2], 10) : size - 1
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
      return NextResponse.json({ error: "Range hors limites" }, { status: 416 })
    }
    end = Math.min(end, size - 1)
    const chunk = end - start + 1
    const stream = createReadStream(filePath, { start, end })
    return new NextResponse(stream as unknown as BodyInit, {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(chunk),
      },
    })
  }

  const stream = createReadStream(filePath)
  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      ...commonHeaders,
      "Content-Length": String(size),
    },
  })
}
