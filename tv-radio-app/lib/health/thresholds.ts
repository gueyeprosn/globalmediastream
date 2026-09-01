export type HealthLevel = 'ok' | 'warning' | 'critical'

/** Aligné sur monitoring/prometheus/alerts/streaming-v2.yml */
export const THRESHOLDS = {
  cpu: { warning: 85, critical: 95 },
  ram: { warning: 90, critical: 97 },
  disk: { warning: 85, critical: 95 },
} as const

export function levelForPercent(
  value: number,
  kind: keyof typeof THRESHOLDS
): HealthLevel {
  const t = THRESHOLDS[kind]
  if (value >= t.critical) return 'critical'
  if (value >= t.warning) return 'warning'
  return 'ok'
}

export function barColor(level: HealthLevel): string {
  if (level === 'critical') return 'bg-red-500'
  if (level === 'warning') return 'bg-amber-400'
  return 'bg-emerald-400'
}

export function textColor(level: HealthLevel): string {
  if (level === 'critical') return 'text-red-300'
  if (level === 'warning') return 'text-amber-300'
  return 'text-emerald-300'
}

export function badgeClass(level: HealthLevel): string {
  if (level === 'critical') return 'bg-red-500/15 text-red-300 border-red-500/30'
  if (level === 'warning') return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
}
