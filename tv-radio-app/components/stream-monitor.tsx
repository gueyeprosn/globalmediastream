"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
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
import { Play, Pause, RotateCcw, Signal, Radio, Tv, Activity, Cpu, HardDrive } from "lucide-react"
import { toast } from "sonner"
import { usePolling } from "@/hooks/usePolling"
import { apiFetch } from "@/lib/api-fetch"

interface Stream {
  id: string
  name: string
  type: 'rtmp' | 'srt'
  status: 'active' | 'inactive' | 'error'
  service: string
  inputPort?: number
  outputPort?: number
  hlsUrl?: string
  rtmpInputUrl?: string
  rtmpOutputUrl?: string
  srtInputUrl?: string
  srtOutputUrl?: string
  uptime?: string
  cpu?: number
  memory?: string
  logs?: string[]
}

export function StreamMonitor() {
  const [selectedStream, setSelectedStream] = useState<string | null>(null)

  const fetchStreams = async () => {
    const response = await apiFetch('/api/streams', {
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    return data
  }

  const { data, loading, error } = usePolling(fetchStreams, 5000, true)
  const streams = data?.streams || []

  // Écouter les événements de mise à jour depuis stream-creator
  useEffect(() => {
    const handleUpdate = () => {
      // Le polling se chargera automatiquement de rafraîchir
      // On peut forcer un refresh en invalidant le cache
    }
    window.addEventListener('streams-updated', handleUpdate)
    return () => window.removeEventListener('streams-updated', handleUpdate)
  }, [])

  const handleAction = async (streamId: string, action: 'start' | 'stop' | 'restart') => {
    try {
      const response = await apiFetch(`/api/streams/${streamId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await response.json()
      if (data.success) {
        const actionLabels = {
          start: 'démarré',
          stop: 'arrêté',
          restart: 'redémarré'
        }
        toast.success(`Flux ${actionLabels[action]} avec succès`, {
          description: `L'action a été effectuée sur le flux`,
          duration: 3000,
        })
        // Le polling se chargera de rafraîchir automatiquement
      } else {
        toast.error('Erreur', {
          description: data.error || 'Une erreur est survenue',
          duration: 5000,
        })
      }
    } catch (error: any) {
      toast.error('Erreur', {
        description: error.message || 'Une erreur inattendue est survenue',
        duration: 5000,
      })
    }
  }

  if (loading) {
    return <div className="p-6">Chargement...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Contrôle des Flux Streaming</h1>
        <Button onClick={() => window.dispatchEvent(new Event('streams-updated'))} variant="outline">
          <RotateCcw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Erreur lors de la récupération des flux: {error.message}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {streams.map((stream: Stream) => (
          <Card key={stream.id} className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {stream.type === 'rtmp' ? (
                  <Radio className="h-5 w-5 text-primary" />
                ) : (
                  <Signal className="h-5 w-5 text-accent" />
                )}
                <div>
                  <h3 className="font-semibold">{stream.name}</h3>
                  <p className="text-sm text-muted-foreground">{stream.type.toUpperCase()}</p>
                </div>
              </div>
              <Badge variant={stream.status === 'active' ? 'default' : 'secondary'}>
                {stream.status === 'active' ? 'Actif' : 'Inactif'}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Service:</span>
                <span className="font-mono text-xs">{stream.service}</span>
              </div>
              {stream.inputPort && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Port Input:</span>
                  <span className="font-mono">{stream.inputPort}</span>
                </div>
              )}
              {stream.outputPort && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Port Output:</span>
                  <span className="font-mono">{stream.outputPort}</span>
                </div>
              )}
              {stream.uptime && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Uptime:</span>
                  <span>{stream.uptime}</span>
                </div>
              )}
              {stream.cpu !== undefined && (
                <div className="flex items-center gap-2">
                  <Cpu className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs">{stream.cpu.toFixed(1)}% CPU</span>
                  <HardDrive className="h-3 w-3 text-muted-foreground ml-2" />
                  <span className="text-xs">{stream.memory}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {stream.status === 'active' ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive">
                      <Pause className="h-4 w-4 mr-1" />
                      Arrêter
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmer l'arrêt</AlertDialogTitle>
                      <AlertDialogDescription>
                        Êtes-vous sûr de vouloir arrêter le flux "{stream.name}" ? 
                        Cette action interrompra le streaming en cours.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleAction(stream.id, 'stop')}>
                        Confirmer l'arrêt
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleAction(stream.id, 'start')}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Démarrer
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Redémarrer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmer le redémarrage</AlertDialogTitle>
                    <AlertDialogDescription>
                      Êtes-vous sûr de vouloir redémarrer le flux "{stream.name}" ? 
                      Le service sera temporairement interrompu.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleAction(stream.id, 'restart')}>
                      Confirmer le redémarrage
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {(stream.rtmpInputUrl || stream.srtInputUrl) && (
              <div className="pt-2 border-t space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">URLs:</p>
                {stream.rtmpInputUrl && (
                  <p className="text-xs font-mono break-all">{stream.rtmpInputUrl}</p>
                )}
                {stream.srtInputUrl && (
                  <p className="text-xs font-mono break-all">{stream.srtInputUrl}</p>
                )}
                {stream.hlsUrl && (
                  <p className="text-xs font-mono break-all text-primary">{stream.hlsUrl}</p>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
