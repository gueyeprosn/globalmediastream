"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"

type RecordingStreamCardProps = {
  streamName: string
  protocol: string
  port: string
  isRecording: boolean
  isStreamLive: boolean
  startedAt?: number
  /** Désactive Record pendant une autre action API (start/stop). */
  actionsLocked?: boolean
  /** Bloque uniquement le démarrage (ex. disque critique). */
  startBlocked?: boolean
  startBlockedReason?: string
  onStart: () => void
  onStop: () => void
}

function formatDuration(ms: number) {
  const sec = Math.max(0, Math.floor(ms / 1000))
  const h = String(Math.floor(sec / 3600)).padStart(2, "0")
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0")
  const s = String(sec % 60).padStart(2, "0")
  return `${h}:${m}:${s}`
}

export function RecordingStreamCard({
  streamName,
  protocol,
  port,
  isRecording,
  isStreamLive,
  startedAt,
  actionsLocked,
  startBlocked,
  startBlockedReason,
  onStart,
  onStop,
}: RecordingStreamCardProps) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const duration = useMemo(() => (isRecording && startedAt ? formatDuration(now - startedAt) : null), [isRecording, startedAt, now])
  const sizeEstimate = useMemo(() => {
    if (!isRecording || !startedAt) return null
    const min = (now - startedAt) / 60000
    return `${((min / 5) * 0.5).toFixed(1)} GB (est.)`
  }, [isRecording, startedAt, now])

  return (
    <div className={`rounded-xl border p-4 ${isRecording ? "border-red-500/50 bg-red-500/10" : "border-border/80 bg-card"}`}>
      {isRecording ? <span className="mb-3 block h-[2px] w-full rounded bg-red-500" /> : null}
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold text-foreground">{streamName}</p>
        <span className="rounded-full border border-border/80 px-2 py-0.5 text-[11px] text-muted-foreground">{protocol}</span>
      </div>
      <p className="text-xs text-muted-foreground">{port}</p>
      <p className={`mt-2 text-sm ${isRecording ? "text-red-300" : "text-muted-foreground"}`}>
        {isRecording ? "● ENREGISTREMENT" : "IDLE"}
      </p>
      {duration ? <p className="mt-1 font-mono text-xl font-semibold text-red-300">{duration}</p> : null}
      {sizeEstimate ? <p className="mt-1 text-xs text-red-200">{sizeEstimate}</p> : null}
      {!isRecording && !isStreamLive ? (
        <p className="mt-2 text-xs text-amber-200/90">
          Flux signalé hors ligne : l&apos;enregistrement peut échouer si le HLS n&apos;est pas disponible.
        </p>
      ) : null}
      <div className="mt-3">
        {isRecording ? (
          <Button className="w-full" variant="destructive" onClick={onStop} disabled={actionsLocked}>
            ⏹ Stop
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={onStart}
            disabled={actionsLocked || startBlocked}
            title={
              startBlocked
                ? startBlockedReason || "Espace disque insuffisant"
                : !isStreamLive
                  ? "Démarrer quand même (FFmpeg)"
                  : undefined
            }
          >
            ⏺ Record
          </Button>
        )}
      </div>
    </div>
  )
}

