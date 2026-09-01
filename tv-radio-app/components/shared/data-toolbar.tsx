"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type DataToolbarProps = {
  children: ReactNode
  className?: string
}

export function DataToolbar({ children, className }: DataToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-4",
        className
      )}
    >
      {children}
    </div>
  )
}
