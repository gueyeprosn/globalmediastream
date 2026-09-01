"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type StatusTone = "live" | "idle" | "error" | "warn" | "rec" | "neutral"

const toneClasses: Record<StatusTone, string> = {
  live: "border-primary/30 bg-primary/15 text-primary",
  idle: "border-border bg-muted text-muted-foreground",
  error: "border-destructive/30 bg-destructive/15 text-red-400",
  warn: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  rec: "border-destructive/30 bg-destructive/15 text-red-400",
  neutral: "border-border bg-secondary text-secondary-foreground",
}

type StatusBadgeProps = {
  label: string
  tone?: StatusTone
  className?: string
}

export function StatusBadge({ label, tone = "neutral", className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-md font-medium tracking-wide", toneClasses[tone], className)}
    >
      {label}
    </Badge>
  )
}
