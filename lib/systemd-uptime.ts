/**
 * Parse / format des timestamps systemd (ActiveEnterTimestamp, etc.)
 * Partagé entre /api/streams, /traffic, routes RTMP.
 */

export function parseSystemdTimestamp(raw: string): {
  startedAt: string | null
  uptimeSec: number | null
} {
  const t = raw.trim()
  if (!t || t === 'n/a' || t === '0') return { startedAt: null, uptimeSec: null }
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return { startedAt: null, uptimeSec: null }
  const uptimeSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  return { startedAt: d.toISOString(), uptimeSec }
}

/** Affichage compact type `2d 3h 12m` / `45m`. */
export function formatUptimeSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
