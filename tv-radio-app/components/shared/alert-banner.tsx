"use client"

import Link from "next/link"
import { AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AlertBannerProps = {
  message: string
  onDismiss: () => void
  actionHref?: string
  actionLabel?: string
  tone?: "warn" | "danger" | "info"
  className?: string
}

const toneStyles = {
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  danger: "border-destructive/30 bg-destructive/10 text-red-300",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-200",
}

export function AlertBanner({
  message,
  onDismiss,
  actionHref,
  actionLabel,
  tone = "warn",
  className,
}: AlertBannerProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        toneStyles[tone],
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p className="text-sm">{message}</p>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        {actionHref && actionLabel ? (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="border-current/30 bg-transparent hover:bg-white/10"
          >
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Fermer alerte"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
