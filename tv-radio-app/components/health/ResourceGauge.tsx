"use client"

import { barColor, levelForPercent, textColor, type HealthLevel } from "@/lib/health/thresholds"
import { cn } from "@/lib/utils"

type ResourceGaugeProps = {
  label: string
  value: number
  display?: string
  kind: "cpu" | "ram" | "disk"
  className?: string
}

export function ResourceGauge({ label, value, display, kind, className }: ResourceGaugeProps) {
  const level = levelForPercent(value, kind)
  const pct = Math.min(100, Math.max(0, value))

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={cn("font-mono text-lg", textColor(level))}>
          {display ?? `${value.toFixed(1)}%`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-700">
        <div
          className={cn("h-2 rounded-full transition-all", barColor(level))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

type HealthBadgeProps = {
  status: "healthy" | "degraded" | "critical"
  score?: number
  className?: string
}

const STATUS_LABELS: Record<HealthBadgeProps["status"], string> = {
  healthy: "Sain",
  degraded: "Dégradé",
  critical: "Critique",
}

const STATUS_CLASSES: Record<HealthBadgeProps["status"], string> = {
  healthy: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  degraded: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  critical: "bg-red-500/15 text-red-300 border-red-500/30",
}

export function HealthBadge({ status, score, className }: HealthBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        STATUS_CLASSES[status],
        className
      )}
    >
      {STATUS_LABELS[status]}
      {typeof score === "number" ? <span className="opacity-80">· {score}%</span> : null}
    </span>
  )
}

export function componentDotColor(level: HealthLevel): string {
  if (level === "critical") return "text-red-400"
  if (level === "warning") return "text-amber-400"
  return "text-emerald-400"
}
