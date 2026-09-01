"use client"

import { useEffect, useRef } from "react"
import { useStreams } from "@/hooks/useStreams"
import { useGlobalMetrics } from "@/hooks/useMetrics"
import { useAppStore } from "@/stores/useAppStore"

const PACKET_LOSS_THRESHOLD_PERCENT = 5
const ALERT_DEBOUNCE_MINUTES = 5

function minuteKey() {
  return Math.floor(Date.now() / (60 * 1000)).toString()
}

export function useAlertsFromMetrics() {
  const { data: streams = [] } = useStreams()
  const { data: globalMetrics } = useGlobalMetrics()
  const addAlert = useAppStore((s) => s.addAlert)

  const previousActiveIds = useRef<Set<string>>(new Set())
  const alertedKeys = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!streams.length) return

    const activeIds = new Set<string>(
      streams
        .filter((s: { status?: string }) => s.status === "running")
        .map((s: { id: string }) => s.id)
    )

    // Stream down: was active, now inactive
    previousActiveIds.current.forEach((id) => {
      if (!activeIds.has(id)) {
        const key = `streamDown:${id}:${minuteKey()}`
        if (alertedKeys.current.has(key)) return
        alertedKeys.current.add(key)
        const name = streams.find((s: { id: string }) => s.id === id)?.name || id
        addAlert({
          type: "error",
          message: `Flux "${name}" est arrêté ou indisponible`,
          streamId: id,
        })
      }
    })

    previousActiveIds.current = activeIds

    // Prune old keys to avoid memory growth (keep last N minutes)
    const currentMin = Math.floor(Date.now() / (60 * 1000))
    const toDelete: string[] = []
    alertedKeys.current.forEach((k) => {
      const parts = k.split(":")
      const min = parseInt(parts[parts.length - 1], 10)
      if (currentMin - min > ALERT_DEBOUNCE_MINUTES) toDelete.push(k)
    })
    toDelete.forEach((k) => alertedKeys.current.delete(k))
  }, [streams, addAlert])

  useEffect(() => {
    if (!globalMetrics || globalMetrics.packetLoss == null) return

    const loss = globalMetrics.packetLoss
    if (loss < PACKET_LOSS_THRESHOLD_PERCENT) return

    const key = `packetLoss:${minuteKey()}`
    if (alertedKeys.current.has(key)) return
    alertedKeys.current.add(key)

    addAlert({
      type: "warning",
      message: `Perte de paquets élevée : ${loss.toFixed(2)}%`,
    })
  }, [globalMetrics, addAlert])
}
