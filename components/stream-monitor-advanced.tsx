"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Play, Pause, RotateCcw, Signal, Radio, Monitor, Wifi, Users, Video, Music, Search, Globe } from "lucide-react"
import { toast } from "sonner"
import { usePolling } from "@/hooks/usePolling"
import { apiFetch } from "@/lib/api-fetch"

interface AdvancedStreamMetrics {
  id: string
  name: string
  type: 'rtmp' | 'srt'
  status: 'active' | 'inactive'
  
  // Métriques vidéo/audio
  resolution?: string
  width?: number
  height?: number
  framerate?: number
  bitrateVideo?: number // kbps
  bitrateAudio?: number // kbps
  codecVideo?: string
  codecAudio?: string
  
  // Métriques réseau
  publisherIP?: string
  viewers?: number
  viewerCountries?: Record<string, number>
  viewerIpsSample?: string[]

  // Métadonnées
  lastUpdated?: string
  error?: string
}

export interface StreamMonitorAdvancedProps {
  /** Afficher le titre et la date de mise à jour (désactiver quand intégré dans la page Monitoring) */
  showTitle?: boolean
}

export function StreamMonitorAdvanced({ showTitle = true }: StreamMonitorAdvancedProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchAdvancedStreams = async () => {
    const response = await apiFetch('/api/streams/advanced', {
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    setLastUpdate(new Date())
    return data
  }

  const { data, loading, error } = usePolling(fetchAdvancedStreams, 45_000, true)
  const allStreams = data?.streams || []

  // Filtrer les flux
  const filteredStreams = useMemo(() => {
    return allStreams.filter((stream: AdvancedStreamMetrics) => {
      const q = searchQuery.toLowerCase()
      const countryMatch =
        stream.viewerCountries &&
        Object.keys(stream.viewerCountries).some((c) => c.toLowerCase().includes(q))
      const matchesSearch =
        stream.name.toLowerCase().includes(q) ||
        stream.type.toLowerCase().includes(q) ||
        (stream.publisherIP && stream.publisherIP.includes(searchQuery)) ||
        Boolean(countryMatch)
      const matchesStatus = statusFilter === 'all' || stream.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [allStreams, searchQuery, statusFilter])

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

  const formatBitrate = (bitrate?: number): string => {
    if (!bitrate) return 'N/A'
    if (bitrate >= 1000) {
      return `${(bitrate / 1000).toFixed(2)} Mbps`
    }
    return `${bitrate} kbps`
  }

  const formatCountries = (cc?: Record<string, number>): string => {
    if (!cc || Object.keys(cc).length === 0) return ''
    return Object.entries(cc)
      .sort((a, b) => b[1] - a[1])
      .map(([code, n]) => `${code}:${n}`)
      .join(' · ')
  }

  if (loading && showTitle) {
    return <div className="p-6">Chargement des métriques avancées...</div>
  }

  return (
    <div className={showTitle ? "p-6 space-y-6" : "space-y-4"}>
      {showTitle && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Monitoring Avancé des Flux</h1>
            {lastUpdate && (
              <p className="text-sm text-muted-foreground mt-1">
                Dernière mise à jour : {lastUpdate.toLocaleTimeString("fr-FR")}
              </p>
            )}
          </div>
          <Button onClick={() => window.dispatchEvent(new Event("streams-updated"))} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      )}

      {/* Filtres et recherche */}
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un flux (nom, type, IP)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: "all" | "active" | "inactive") => setStatusFilter(v)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actifs uniquement</SelectItem>
            <SelectItem value="inactive">Inactifs uniquement</SelectItem>
          </SelectContent>
        </Select>
        {!showTitle && (
          <Button
            onClick={() => window.dispatchEvent(new Event("streams-updated"))}
            variant="outline"
            size="sm"
            className="shrink-0"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        )}
      </div>

      {!showTitle && lastUpdate && (
        <p className="text-xs text-muted-foreground">
          Métriques détaillées (logs Nginx + GeoIP) — dernière mise à jour :{" "}
          {lastUpdate.toLocaleTimeString("fr-FR")}
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Erreur lors de la récupération des métriques: {error.message}
          </p>
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Flux</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>IP Source</TableHead>
              <TableHead>Résolution</TableHead>
              <TableHead>FPS</TableHead>
              <TableHead>Bitrate Vidéo</TableHead>
              <TableHead>Bitrate Audio</TableHead>
              <TableHead>Codec Vidéo</TableHead>
              <TableHead>Codec Audio</TableHead>
              <TableHead>Viewers</TableHead>
              <TableHead>Pays (HLS)</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                  Chargement des métriques...
                </TableCell>
              </TableRow>
            ) : filteredStreams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                  {allStreams.length === 0 
                    ? 'Aucun flux disponible' 
                    : 'Aucun flux ne correspond aux critères de recherche'}
                </TableCell>
              </TableRow>
            ) : (
              filteredStreams.map((stream: AdvancedStreamMetrics) => (
                <TableRow key={stream.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {stream.type === 'rtmp' ? (
                        <Radio className="h-4 w-4 text-primary" />
                      ) : (
                        <Signal className="h-4 w-4 text-accent" />
                      )}
                      <div>
                        <div className="font-medium">{stream.name}</div>
                        <div className="text-xs text-muted-foreground">{stream.type.toUpperCase()}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={stream.status === 'active' ? 'default' : 'secondary'}>
                      {stream.status === 'active' ? 'Actif' : 'Inactif'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {stream.publisherIP ? (
                      <div className="flex items-center gap-1">
                        <Wifi className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-xs">{stream.publisherIP}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {stream.resolution ? (
                      <div className="flex items-center gap-1">
                        <Monitor className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-xs">{stream.resolution}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {stream.framerate ? (
                      <span className="font-mono text-sm">{stream.framerate} fps</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {stream.bitrateVideo ? (
                      <div className="flex items-center gap-1">
                        <Video className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{formatBitrate(stream.bitrateVideo)}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {stream.bitrateAudio ? (
                      <div className="flex items-center gap-1">
                        <Music className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{formatBitrate(stream.bitrateAudio)}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {stream.codecVideo ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {stream.codecVideo}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {stream.codecAudio ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {stream.codecAudio}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {stream.viewers !== undefined ? (
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{stream.viewers}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {stream.viewerCountries && Object.keys(stream.viewerCountries).length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1">
                        <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground leading-snug" title={formatCountries(stream.viewerCountries)}>
                          {Object.entries(stream.viewerCountries)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 4)
                            .map(([code, n]) => (
                              <Badge key={code} variant="outline" className="mr-1 mb-0.5 font-mono text-[10px]">
                                {code} {n}
                              </Badge>
                            ))}
                          {Object.keys(stream.viewerCountries).length > 4 ? (
                            <span className="text-muted-foreground">+{Object.keys(stream.viewerCountries).length - 4}</span>
                          ) : null}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {stream.status === 'active' ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <Pause className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmer l'arrêt</AlertDialogTitle>
                              <AlertDialogDescription>
                                Êtes-vous sûr de vouloir arrêter le flux "{stream.name}" ?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleAction(stream.id, 'stop')}>
                                Confirmer
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
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmer le redémarrage</AlertDialogTitle>
                            <AlertDialogDescription>
                              Êtes-vous sûr de vouloir redémarrer le flux "{stream.name}" ?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleAction(stream.id, 'restart')}>
                              Confirmer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filteredStreams.some((s: AdvancedStreamMetrics) => s.error) && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            <strong>Note:</strong> Certains flux peuvent afficher "N/A" si le flux n'est pas actif ou si les métriques ne sont pas encore disponibles.
            Les métriques SRT nécessitent un flux de sortie HLS pour être analysées.
          </p>
        </div>
      )}
    </div>
  )
}
