"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import type { StreamHealthStatus } from "@/lib/stream-health"

const LABELS: Record<StreamHealthStatus, string> = {
  provisioning: "Provisionnement",
  healthy: "Lecture OK",
  degraded: "Dégradé",
  failed: "Échec",
}

const STYLES: Record<StreamHealthStatus, string> = {
  provisioning: "bg-cyan-500/12 text-foreground border-cyan-500/30",
  healthy: "bg-emerald-500/12 text-emerald-200 border-emerald-500/30",
  degraded: "bg-amber-500/12 text-amber-200 border-amber-500/30",
  failed: "bg-red-500/12 text-red-200 border-red-500/30",
}

type StreamHealthBadgeProps = {
  streamId: string
  pollMs?: number
  maxDurationMs?: number
  className?: string
}

export function StreamHealthBadge({
  streamId,
  pollMs = 5000,
  maxDurationMs = 60_000,
  className,
}: StreamHealthBadgeProps) {
  const [status, setStatus] = useState<StreamHealthStatus | null>(null)

  useEffect(() => {
    if (!streamId) return
    let mounted = true
    const started = Date.now()

    const run = async () => {
      try {
        const res = await apiFetch(`/api/streams/${encodeURIComponent(streamId)}/health`, {
          cache: "no-store",
        })
        if (!res.ok) return
        const json = await res.json()
        if (!mounted) return
        setStatus(json.status as StreamHealthStatus)
      } catch {
        /* ignore */
      }
    }

    run()
    const timer = setInterval(() => {
      if (Date.now() - started > maxDurationMs) {
        clearInterval(timer)
        return
      }
      run()
    }, pollMs)

    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [streamId, pollMs, maxDurationMs])

  if (!status) return null

  return (
    <Badge variant="outline" className={cn(STYLES[status], className)} title={`Santé flux: ${LABELS[status]}`}>
      {LABELS[status]}
    </Badge>
  )
}

export function useStreamHealthPoll(streamId: string, enabled = true) {
  const [status, setStatus] = useState<StreamHealthStatus | null>(null)

  useEffect(() => {
    if (!enabled || !streamId) return
    let mounted = true
    const started = Date.now()

    const run = async () => {
      try {
        const res = await apiFetch(`/api/streams/${encodeURIComponent(streamId)}/health`, {
          cache: "no-store",
        })
        if (!res.ok) return
        const json = await res.json()
        if (mounted) setStatus(json.status as StreamHealthStatus)
      } catch {
        /* ignore */
      }
    }

    run()
    const timer = setInterval(() => {
      if (Date.now() - started > 60_000) {
        clearInterval(timer)
        return
      }
      run()
    }, 5000)

    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [streamId, enabled])

  return status
}
