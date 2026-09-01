"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type MetricSparklineProps = {
  children: ReactNode
  className?: string
}

/** Lightweight wrapper for sparkline / mini chart areas inside metric layouts. */
export function MetricSparkline({ children, className }: MetricSparklineProps) {
  return (
    <div className={cn("h-12 w-full overflow-hidden rounded-md bg-muted/30", className)}>
      {children}
    </div>
  )
}
