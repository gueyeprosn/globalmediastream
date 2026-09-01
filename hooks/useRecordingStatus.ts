"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"

type ActiveRecording = {
  streamId: string
  pid: number
  filePath: string
  startedAt: number
}

type RecordingStatusResponse = {
  active?: Record<string, ActiveRecording>
}

export function useRecordingStatus() {
  const [activeRecordings, setActiveRecordings] = useState<Record<string, ActiveRecording>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        const res = await apiFetch("/api/recordings/status", { cache: "no-store" })
        const json = (await res.json()) as RecordingStatusResponse
        if (!mounted) return
        setActiveRecordings(json.active || {})
      } catch {
        if (!mounted) return
        setActiveRecordings({})
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
  }, [])

  const isRecording = (streamName: string) => Boolean(activeRecordings[streamName])

  return { activeRecordings, isRecording, loading }
}

