"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"
import { componentDotColor } from "@/components/health/ResourceGauge"
import type { HealthComponent } from "@/lib/health/scoring"

type ServiceHealth = {
  name: string
  status: string
  color: string
  ok: boolean
  level: HealthComponent["level"]
}

export function useServiceHealth() {
  const [services, setServices] = useState<ServiceHealth[]>([])
  const [uptime, setUptime] = useState<string>("")
  const [overallStatus, setOverallStatus] = useState<"healthy" | "degraded" | "critical">("healthy")
  const [score, setScore] = useState<number>(100)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        const res = await apiFetch("/api/system/health", { cache: "no-store" })
        if (!res.ok) throw new Error("health unavailable")
        const json = await res.json()
        if (!mounted) return

        const components = (json.components || []) as HealthComponent[]
        setOverallStatus(json.status || "healthy")
        setScore(json.score ?? 100)

        const dockerSrs = components.find((c) => c.id === "docker-srs")
        setUptime(dockerSrs?.detail?.split(" · ")[1] || "")

        setServices(
          components
            .filter((c) => !["cpu", "ram", "disk"].includes(c.id))
            .map((c) => ({
              name: c.label,
              status: c.detail,
              color: componentDotColor(c.level),
              ok: c.level === "ok",
              level: c.level,
            }))
        )
      } catch {
        if (!mounted) return
        setServices([])
        setUptime("")
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

  return { services, uptime, loading, overallStatus, score }
}
