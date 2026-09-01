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
  /** Si défini, arrête le poll après cette durée. Sinon : tant que la carte est montée. */
  maxDurationMs?: number
  className?: string
}

export function StreamHealthBadge({
  streamId,
  pollMs = 5000,
  maxDurationMs,
  className,
}: StreamHealthBadgeProps) {
  const [status, setStatus] = useState<StreamHealthStatus | null>(null)

  useEffect(() => {
    if (!streamId) return
    let mounted = true
    const started = Date.now()
    let timer: ReturnType<typeof setInterval> | null = null

    const run = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
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

    const tick = () => {
      if (maxDurationMs != null && Date.now() - started > maxDurationMs) {
        if (timer) clearInterval(timer)
        return
      }
      void run()
    }

    void run()
    timer = setInterval(tick, pollMs)

    const onVis = () => {
      if (document.visibilityState === "visible") void run()
    }
    document.addEventListener("visibilitychange", onVis)

    return () => {
      mounted = false
      if (timer) clearInterval(timer)
      document.removeEventListener("visibilitychange", onVis)
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
    let timer: ReturnType<typeof setInterval> | null = null

    const run = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
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

    void run()
    timer = setInterval(() => void run(), 5000)

    const onVis = () => {
      if (document.visibilityState === "visible") void run()
    }
    document.addEventListener("visibilitychange", onVis)

    return () => {
      mounted = false
      if (timer) clearInterval(timer)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [streamId, enabled])

  return status
}
