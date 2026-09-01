import path from "node:path"

export const RECORDINGS_DIR = process.env.RECORDINGS_DIR || "/srv/recordings"

/** Nom de fichier seul, sans chemin ni `..`. */
export function parseSafeRecordingFilename(id: string): string | null {
  let s = id
  try {
    s = decodeURIComponent(id)
  } catch {
    /* id déjà décodé */
  }
  s = s.replaceAll(/[/\\]/g, "")
  if (!s || s.includes("..")) return null
  return s
}

export function recordingAbsPath(filename: string): string {
  return path.join(RECORDINGS_DIR, filename)
}
