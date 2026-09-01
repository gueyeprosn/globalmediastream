"use client"

import { Play, Pause, Edit, Trash2, RotateCcw } from "lucide-react"
import { useStartStream, useStopStream, useRestartStream } from "@/hooks/useStreams"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import type { Stream } from "@/types/streams"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface StreamCardProps {
  stream: Stream
  onEdit: (stream: Stream) => void
}

export function StreamCard({ stream, onEdit }: StreamCardProps) {
  const startMutation = useStartStream()
  const stopMutation = useStopStream()
  const restartMutation = useRestartStream()

  const isRunning = stream.status === 'running'
  const isLoading =
    startMutation.isPending || stopMutation.isPending || restartMutation.isPending

  const handleStart = () => {
    startMutation.mutate(stream.id, {
      onSuccess: () => toast.success('Flux démarré'),
      onError: () => toast.error('Échec du démarrage'),
    })
  }

  const handleStop = () => {
    stopMutation.mutate(stream.id, {
      onSuccess: () => toast.success('Flux arrêté'),
      onError: () => toast.error("Échec de l'arrêt"),
    })
  }

  const handleRestart = () => {
    restartMutation.mutate(stream.id, {
      onSuccess: () => toast.success('Flux redémarré'),
      onError: () => toast.error('Échec du redémarrage'),
    })
  }

  const statusLabel = isRunning ? "En cours" : "Arrêté"
  const canControlService = stream.protocol !== "icecast"

  return (
    <Card className="border-border/80 bg-card card-interactive">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {stream.name}
            </h3>
            <Badge
              className={cn(
                "mt-1",
                isRunning
                  ? "bg-green-500/12 text-green-700 dark:text-green-200"
                  : "bg-slate-500/12 text-foreground/90"
              )}
            >
              {statusLabel}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(stream)}
              disabled={isLoading}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2 text-sm mb-4">
          {stream.protocol === 'icecast' && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mountpoint:</span>
                <span className="font-mono text-xs text-foreground">
                  {(stream as any).mountpoint || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Listeners:</span>
                <span className="font-semibold text-foreground">
                  {(stream as any).listeners || 0}
                  {(stream as any).listenerPeak && (stream as any).listenerPeak > 0 && (
                    <span className="ml-1 text-muted-foreground">
                      (peak: {(stream as any).listenerPeak})
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bitrate:</span>
                <span className="font-semibold text-foreground">
                  {(stream as any).bitrate || 128} kbps
                </span>
              </div>
            </>
          )}
          <div>
            <span className="text-muted-foreground">Input:</span>
            <p className="font-mono text-xs break-all text-foreground">
              {stream.inputUrl || 'N/A'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Output:</span>
            <p className="font-mono text-xs break-all text-foreground">
              {stream.outputUrl || 'N/A'}
            </p>
          </div>
        </div>

        {canControlService ? (
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
                      Êtes-vous sûr de vouloir arrêter "{stream.name}" ?
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
                    Êtes-vous sûr de vouloir redémarrer "{stream.name}" ?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRestart}>Redémarrer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <div className="rounded-md border border-cyan-500/20 bg-cyan-500/8 px-3 py-2 text-xs text-foreground">
            Contrôle local indisponible pour ce mountpoint Icecast. Utilisez le service global{" "}
            <span className="font-mono">icecast2</span> côté serveur.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

