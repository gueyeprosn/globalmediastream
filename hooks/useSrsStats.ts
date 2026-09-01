"use client"

import { useEffect, useMemo, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"

type SrsStreamStat = {
  name: string
  app: string
  stream: string
  bw_in_kbps: number
  bw_out_kbps: number
  publishActive?: boolean
  nclients: number
  publish_duration_ms: number
  video?: { width?: number; height?: number; fps?: number; codec?: string }
}

type SrsStatsResponse = {
  streams: SrsStreamStat[]
  global: {
    recv_bytes: number
    send_bytes: number
    nb_streams: number
    nb_clients: number
  }
  ok: boolean
  error?: string
}

type Histories = {
  bitrate: number[]
  clients: number[]
}

export function useSrsStats(refreshToken = 0) {
  const [data, setData] = useState<SrsStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<Histories>({ bitrate: [], clients: [] })

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        const res = await apiFetch("/api/srs-stats", { cache: "no-store" })
        const json = (await res.json()) as SrsStatsResponse
        if (!mounted) return
        setData(json)
        setError(json.ok ? null : json.error || "SRS unreachable")
        const totalBitrateKbps = (json.streams || []).reduce((acc, s) => acc + (s.bw_in_kbps || 0), 0)
        const totalClients = (json.streams || []).reduce((acc, s) => acc + (s.nclients || 0), 0)
        setHistory((prev) => ({
          bitrate: [...prev.bitrate.slice(-31), Number((totalBitrateKbps / 1000).toFixed(2))],
          clients: [...prev.clients.slice(-31), totalClients],
        }))
      } catch {
        if (!mounted) return
        setError("SRS unreachable")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    run()
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      void run()
    }, 8000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [refreshToken])

  const totalBitrateMbps = useMemo(
    () => Number((((data?.streams || []).reduce((acc, s) => acc + (s.bw_in_kbps || 0), 0) || 0) / 1000).toFixed(2)),
    [data]
  )

  const totalClients = useMemo(
    () => (data?.streams || []).reduce((acc, s) => acc + (s.nclients || 0), 0),
    [data]
  )

  const getStreamByName = (name: string) =>
    (data?.streams || []).find((s) => s.name.toLowerCase() === name.toLowerCase() || s.stream.toLowerCase() === name.toLowerCase())

  return {
    streams: data?.streams || [],
    global: data?.global,
    ok: data?.ok ?? false,
    loading,
    error,
    history,
    getStreamByName,
    totalBitrateMbps,
    totalClients,
  }
}

