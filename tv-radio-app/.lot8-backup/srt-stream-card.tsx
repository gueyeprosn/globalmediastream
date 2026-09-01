"use client"

import Link from "next/link"
import { Play, Pause, RotateCcw, Copy, Check, Tv, ExternalLink } from "lucide-react"
import { useStartStream, useStopStream, useRestartStream } from "@/hooks/useStreams"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useState } from "react"
import { toast } from "sonner"
import { StreamHealthBadge } from "@/components/streams/StreamHealthBadge"
import { cn } from "@/lib/utils"

export interface SRTStreamData {
  id: string
  name: string
  status: string
  srtInputUrl?: string
  srtOutputUrl?: string
  /** Plusieurs sorties relay (aligné sur GET /api/streams). */
  srtOutputUrls?: string[]
  hlsUrl?: string
  inputPort?: number
  outputPort?: number
  uptime?: string
  cpu?: number
  memory?: string
}

interface SRTStreamCardProps {
  stream: SRTStreamData
}

/** Liens lecteur /watch pour les pipelines SRT→HLS figés sur le serveur. */
const WATCH_BY_STREAM_ID: Record<string, { href: string; label: string }> = {
  toubatv: { href: "/watch", label: "Voir le direct Touba TV" },
  "external-tv": { href: "/watch?c=external-tv", label: "Voir le direct External TV" },
  "external-tv-2": { href: "/watch?c=external-tv-2", label: "Voir le direct External TV 2" },
  "external-tv-3": { href: "/watch?c=external-tv-3", label: "Voir le direct External TV 3" },
}

function copyToClipboard(text: string, label: string, setCopied: (v: string | null) => void) {
  navigator.clipboard.writeText(text).then(
    () => {
      setCopied(label)
      toast.success(`${label} copié`)
      setTimeout(() => setCopied(null), 2000)
    },
    () => toast.error("Copie impossible")
  )
}

export function SRTStreamCard({ stream }: SRTStreamCardProps) {
  const startMutation = useStartStream()
  const stopMutation = useStopStream()
  const restartMutation = useRestartStream()
  const [copied, setCopied] = useState<string | null>(null)

  const isRunning = stream.status === "running" || stream.status === "active"
  const isLoading =
    startMutation.isPending || stopMutation.isPending || restartMutation.isPending

  const inputUrl = stream.srtInputUrl
  const srtOutUrls =
    stream.srtOutputUrls && stream.srtOutputUrls.length > 0
      ? stream.srtOutputUrls
      : stream.srtOutputUrl
        ? [stream.srtOutputUrl]
        : []
  const hasHls = Boolean(stream.hlsUrl)
  const watchDirect = WATCH_BY_STREAM_ID[stream.id]

  const handleStart = () => {
    startMutation.mutate(stream.id, {
      onSuccess: () => toast.success("Flux démarré"),
      onError: () => toast.error("Échec du démarrage"),
    })
  }

  const handleStop = () => {
    stopMutation.mutate(stream.id, {
      onSuccess: () => toast.success("Flux arrêté"),
      onError: () => toast.error("Échec de l'arrêt"),
    })
  }

  const handleRestart = () => {
    restartMutation.mutate(stream.id, {
      onSuccess: () => toast.success("Flux redémarré"),
      onError: () => toast.error("Échec du redémarrage"),
    })
  }

  return (
    <Card className="border-border/80 bg-card card-interactive">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {stream.name}
            </h3>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge
                className={cn(
                  isRunning ? "bg-green-500/12 text-green-200" : "bg-slate-500/12 text-foreground/90"
                )}
              >
                {isRunning ? "En direct" : "Arrêté"}
              </Badge>
              {isRunning && hasHls ? <StreamHealthBadge streamId={stream.id} /> : null}
              {stream.uptime && (
                <Badge variant="outline" className="text-xs">
                  Uptime {stream.uptime}
                </Badge>
              )}
              {stream.cpu != null && (
                <Badge variant="outline" className="text-xs">
                  CPU {stream.cpu}%
                </Badge>
              )}
              {stream.memory && (
                <Badge variant="outline" className="text-xs">
                  RAM {stream.memory}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {(stream.inputPort != null ||
          stream.outputPort != null ||
          srtOutUrls.length > 0) && (
          <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
            {stream.inputPort != null && <div>Entrée : {stream.inputPort}</div>}
            {(srtOutUrls.length > 0 || stream.outputPort != null) && (
              <div>
                Sortie{srtOutUrls.length > 1 ? "s" : ""} SRT :{" "}
                {srtOutUrls.length > 0
                  ? srtOutUrls
                      .map((u) => {
                        const m = u.match(/^srt:\/\/[^:]*:(\d+)/)
                        return m ? m[1] : null
                      })
                      .filter((p): p is string => p != null)
                      .join(", ")
                  : stream.outputPort != null
                    ? String(stream.outputPort)
                    : "—"}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3 text-sm mb-4">
          {inputUrl && (
            <div className="rounded border bg-muted/30 p-2">
              <p className="text-muted-foreground font-medium mb-1">Entrée SRT</p>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="flex-1 min-w-0 break-all text-xs bg-background px-2 py-1 rounded">
                  {inputUrl}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-7 w-7"
                  onClick={() => copyToClipboard(inputUrl, "URL SRT entrée", setCopied)}
                >
                  {copied === "URL SRT entrée" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}
          {hasHls && stream.hlsUrl && (
            <div className="rounded border bg-muted/30 p-2">
              <p className="text-muted-foreground font-medium mb-1">Sortie HLS</p>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="flex-1 min-w-0 break-all text-xs bg-background px-2 py-1 rounded">
                  {stream.hlsUrl}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-7 w-7"
                  onClick={() =>
                    copyToClipboard(stream.hlsUrl!, "URL HLS", setCopied)
                  }
                >
                  {copied === "URL HLS" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}
          {!hasHls &&
            srtOutUrls.map((url, i) => {
              const label = `URL SRT sortie ${i + 1}`
              return (
                <div key={`${label}-${url.slice(0, 24)}`} className="rounded border bg-muted/30 p-2">
                  <p className="text-muted-foreground font-medium mb-1">
                    Sortie SRT {srtOutUrls.length > 1 ? `(${i + 1}/${srtOutUrls.length})` : ""}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="flex-1 min-w-0 break-all text-xs bg-background px-2 py-1 rounded">
                      {url}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-7 w-7"
                      onClick={() => copyToClipboard(url, label, setCopied)}
                    >
                      {copied === label ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
        </div>

        {watchDirect && (
          <Link
            href={watchDirect.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 block"
          >
            <Button variant="default" size="sm" className="w-full sm:w-auto">
              <Tv className="mr-2 h-4 w-4" />
              {watchDirect.label}
              <ExternalLink className="ml-2 h-3 w-3" />
            </Button>
          </Link>
        )}

        <div className="flex gap-2">
          {isRunning ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  disabled={isLoading}
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Arrêter
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Arrêter le flux</AlertDialogTitle>
                  <AlertDialogDescription>
                    Êtes-vous sûr de vouloir arrêter « {stream.name} » ?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleStop}>Arrêter</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              size="sm"
              variant="default"
              className="flex-1"
              onClick={handleStart}
              disabled={isLoading}
            >
              <Play className="h-4 w-4 mr-1" />
              Démarrer
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={isLoading}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Redémarrer le flux</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir redémarrer « {stream.name} » ?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleRestart}>Redémarrer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}
