"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"

type SystemStats = {
  cpu_percent: number
  mem_used_gb: number
  mem_total_gb: number
  disk_used_gb: number
  disk_free_gb: number
  disk_total_gb: number
  disk_percent: number
}

type MetricsApiResponse = {
  cpuUsage?: number
  memory?: {
    used?: number
    total?: number
  }
  disk?: {
    used?: number
    free?: number
    total?: number
    percentage?: number
  }
}

function fromMetricsApi(payload: MetricsApiResponse): SystemStats {
  const memUsedGb = Number(((payload.memory?.used || 0) / 1024).toFixed(1))
  const memTotalGb = Number(((payload.memory?.total || 0) / 1024).toFixed(1))
  return {
    cpu_percent: Number((payload.cpuUsage || 0).toFixed(1)),
    mem_used_gb: memUsedGb,
    mem_total_gb: memTotalGb,
    disk_used_gb: Number((payload.disk?.used || 0).toFixed(1)),
    disk_free_gb: Number((payload.disk?.free || 0).toFixed(1)),
    disk_total_gb: Number((payload.disk?.total || 0).toFixed(1)),
    disk_percent: Number((payload.disk?.percentage || 0).toFixed(1)),
  }
}

export function useSystemStats() {
  const [data, setData] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<{
    cpu: number[]
    mem: number[]
    disk: number[]
  }>({ cpu: [], mem: [], disk: [] })

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        let json: SystemStats
        const metricsRes = await apiFetch("/api/system/metrics", { cache: "no-store" })
        if (metricsRes.ok) {
          json = fromMetricsApi((await metricsRes.json()) as MetricsApiResponse)
        } else {
          const fallbackRes = await apiFetch("/api/system-stats", { cache: "no-store" })
          if (!fallbackRes.ok) throw new Error("system-stats unavailable")
          json = (await fallbackRes.json()) as SystemStats
        }
        if (!mounted) return
        setData(json)
        setError(null)
        setHistory((prev) => ({
          cpu: [...prev.cpu.slice(-31), json.cpu_percent ?? 0],
          mem: [...prev.mem.slice(-31), json.mem_total_gb > 0 ? Number((((json.mem_used_gb || 0) / json.mem_total_gb) * 100).toFixed(1)) : 0],
          disk: [...prev.disk.slice(-31), json.disk_percent ?? 0],
        }))
      } catch {
        if (!mounted) return
        setError("system-stats unavailable")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    run()
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      void run()
    }, 10_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  return {
    cpu: data?.cpu_percent ?? 0,
    memUsed: data?.mem_used_gb ?? 0,
    memTotal: data?.mem_total_gb ?? 0,
    diskUsed: data?.disk_used_gb ?? 0,
    diskFree: data?.disk_free_gb ?? 0,
    diskTotal: data?.disk_total_gb ?? 0,
    diskPercent: data?.disk_percent ?? 0,
    history,
    loading,
    error,
    raw: data,
  }
}

