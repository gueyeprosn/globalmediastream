"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type MetricCardProps = {
  label: string
  value: string | number
  sub?: string
  icon?: ReactNode
  href?: string
  tone?: "default" | "live" | "warn" | "danger" | "info"
  /** @deprecated Prefer tone — kept for migration */
  accentColor?: string
  className?: string
}

const toneAccent: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "bg-border",
  live: "bg-primary",
  warn: "bg-amber-500",
  danger: "bg-destructive",
  info: "bg-blue-500",
}

export function MetricCard({
  label,
  value,
  sub,
  icon,
  href,
  tone = "default",
  accentColor,
  className,
}: MetricCardProps) {
  const body = (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p> : null}
      <span
        className={cn(
          "absolute inset-x-0 bottom-0 h-0.5 rounded-b-xl",
          !accentColor && toneAccent[tone]
        )}
        style={accentColor ? { backgroundColor: accentColor } : undefined}
        aria-hidden
      />
    </>
  )

  const classes = cn(
    "relative block overflow-hidden rounded-xl border border-border/80 bg-card p-4 transition-colors duration-200",
    href && "cursor-pointer hover:border-primary/40 hover:bg-card/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
    className
  )

  if (href) {
    return (
      <Link href={href} className={classes} aria-label={`${label}: ${value}`}>
        {body}
      </Link>
    )
  }

  return <div className={classes}>{body}</div>
}
