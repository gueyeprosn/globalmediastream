"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type SectionProps = {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function Section({ title, description, actions, children, className }: SectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || actions) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            {title ? (
              <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  )
}
