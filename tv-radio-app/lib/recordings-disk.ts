/**
 * Espace disque de la partition qui porte RECORDINGS_DIR (via `df -P`).
 * Seuil configurable : RECORDINGS_MIN_FREE_PERCENT (défaut 15 → refuse ≥ 85 % bloquant).
 */

import { spawnCapture } from "@/lib/safe-shell"
import { RECORDINGS_DIR } from "@/lib/recordings-path"

export type RecordingsDiskStats = {
  totalGb: number
  usedGb: number
  freeGb: number
  usedPercent: number
  freePercent: number
  mount: string
}

/** Pourcentage libre minimum requis pour démarrer un enregistrement. */
export function getRecordingsMinFreePercent(): number {
  const raw = process.env.RECORDINGS_MIN_FREE_PERCENT
  const n = raw != null && raw !== "" ? Number(raw) : 15
  if (!Number.isFinite(n) || n < 1 || n > 90) return 15
  return Math.floor(n)
}

/** Parse sortie POSIX `df -P <path>` (blocs 1K). */
export function parseDfDashP(stdout: string): RecordingsDiskStats {
  const lines = stdout
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) throw new Error("df parse error")

  const cols = lines[lines.length - 1].split(/\s+/)
  if (cols.length < 6) throw new Error("df parse error")

  const totalKb = Number(cols[1])
  const usedKb = Number(cols[2])
  const availKb = Number(cols[3])
  const capacity = Number(String(cols[4]).replace("%", ""))
  const mount = cols.slice(5).join(" ") || "/"

  if (![totalKb, usedKb, availKb].every((n) => Number.isFinite(n) && n >= 0)) {
    throw new Error("df parse error")
  }

  const usedPercent = Number.isFinite(capacity)
    ? Math.max(0, Math.min(100, capacity))
    : totalKb > 0
      ? Math.round((usedKb / totalKb) * 100)
      : 0
  const freePercent =
    totalKb > 0 ? Math.max(0, Math.min(100, Math.round((availKb / totalKb) * 100))) : 0

  const toGb = (kb: number) => Number((kb / (1024 * 1024)).toFixed(1))

  return {
    totalGb: toGb(totalKb),
    usedGb: toGb(usedKb),
    freeGb: toGb(availKb),
    usedPercent,
    freePercent,
    mount,
  }
}

export async function getRecordingsDiskStats(
  dir: string = RECORDINGS_DIR
): Promise<RecordingsDiskStats> {
  const { stdout, code, stderr } = await spawnCapture("df", ["-P", dir], {
    timeoutMs: 8_000,
  })
  if (code !== 0) {
    throw new Error(stderr.trim() || `df exited ${code}`)
  }
  return parseDfDashP(stdout)
}

export type DiskGateResult =
  | { ok: true; stats: RecordingsDiskStats; minFreePercent: number }
  | {
      ok: false
      stats: RecordingsDiskStats | null
      minFreePercent: number
      error: string
    }

/** Refuse le démarrage si l’espace libre est sous le seuil (ou si df échoue). */
export async function gateRecordingsDiskSpace(
  dir: string = RECORDINGS_DIR
): Promise<DiskGateResult> {
  const minFreePercent = getRecordingsMinFreePercent()
  try {
    const stats = await getRecordingsDiskStats(dir)
    if (stats.freePercent < minFreePercent) {
      return {
        ok: false,
        stats,
        minFreePercent,
        error: `Espace disque insuffisant sur ${stats.mount} (${stats.freePercent} % libre, minimum ${minFreePercent} %). Libérez de l’espace avant d’enregistrer.`,
      }
    }
    return { ok: true, stats, minFreePercent }
  } catch {
    return {
      ok: false,
      stats: null,
      minFreePercent,
      error:
        "Impossible de vérifier l’espace disque recordings. Enregistrement refusé par sécurité.",
    }
  }
}
