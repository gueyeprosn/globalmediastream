"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"
import type { SystemHealthReport } from "@/lib/health/scoring"

type HealthPayload = SystemHealthReport & {
  metrics?: {
    dockerUptime?: { srs?: string; oryx?: string }
  }
  srs?: { ok: boolean; publisherCount?: number }
}

export function useSystemHealth() {
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        const res = await apiFetch("/api/system/health", { cache: "no-store" })
        if (!res.ok) throw new Error("health unavailable")
        const json = (await res.json()) as HealthPayload
        if (!mounted) return
        setHealth(json)
        setError(null)
      } catch {
        if (!mounted) return
        setError("health unavailable")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      void run()
    }, 20_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  return { health, loading, error }
}
