"use client"

import { cn } from "@/lib/utils"

type LiveIndicatorProps = {
  label?: string
  active?: boolean
  className?: string
}

export function LiveIndicator({
  label = "LIVE",
  active = true,
  className,
}: LiveIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "animate-pulse-live bg-primary" : "bg-muted-foreground"
        )}
        aria-hidden
      />
      {label}
    </span>
  )
}
