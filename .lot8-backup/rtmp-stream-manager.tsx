"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Play, Pause, RotateCcw, Loader2, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { StreamHealthBadge } from "@/components/streams/StreamHealthBadge"
import { apiFetch } from "@/lib/api-fetch"

interface RTMPStream {
  id: string
  name: string
  inputPort: number
  outputPort: number
  streamKey?: string
  service: string
  status: 'active' | 'inactive'
  rtmpInputUrl: string
  rtmpOutputUrl: string
  uptime?: string
  cpu?: number
  memory?: string
}

export interface RTMPStreamManagerProps {
  /** Afficher le titre et le bouton Créer en tête (désactiver quand la page fournit le titre) */
  showTitle?: boolean
}

export function RTMPStreamManager({ showTitle = true }: RTMPStreamManagerProps) {
  const [streams, setStreams] = useState<RTMPStream[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStream, setEditingStream] = useState<RTMPStream | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    inputPort: '',
    outputPort: '',
    streamKey: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const fetchStreams = async () => {
    try {
      const response = await apiFetch('/api/streams/rtmp', {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Erreur lors de la récupération')
      const data = await response.json()
      setStreams(data.streams || [])
    } catch (error: any) {
      toast.error('Erreur', {
        description: error.message || 'Impossible de charger les streams RTMP',
      })
      setStreams([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStreams()
    const interval = setInterval(fetchStreams, 20_000)
    return () => clearInterval(interval)
  }, [])

  const copyUrl = (text: string, label: string, id: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedId(id)
        toast.success(`${label} copié`)
        setTimeout(() => setCopiedId(null), 2000)
      },
      () => toast.error("Copie impossible")
    )
  }

  const handleCreate = () => {
    setEditingStream(null)
    setFormData({
      name: '',
      inputPort: '',
      outputPort: '',
      streamKey: '',
    })
    setDialogOpen(true)
  }

  const handleEdit = (stream: RTMPStream) => {
    setEditingStream(stream)
    setFormData({
      name: stream.name,
      inputPort: stream.inputPort.toString(),
      outputPort: stream.outputPort.toString(),
      streamKey: stream.streamKey || '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const inP = parseInt(formData.inputPort, 10)
    const outP = parseInt(formData.outputPort, 10)
    if (!isNaN(inP) && !isNaN(outP) && inP === outP) {
      toast.error("Le port d'entrée et le port de sortie doivent être différents (ex: 1935 et 1936)")
      return
    }
    setSubmitting(true)

    try {
      const url = editingStream
        ? `/api/streams/rtmp/${editingStream.id}`
        : '/api/streams/rtmp'
      
      const method = editingStream ? 'PUT' : 'POST'
      
      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          inputPort: parseInt(formData.inputPort),
          outputPort: parseInt(formData.outputPort),
          streamKey: formData.streamKey || undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(
          editingStream ? 'Stream modifié avec succès' : 'Stream créé avec succès',
          {
            description: data.message || 'Le stream RTMP est maintenant disponible',
            duration: 5000,
          }
        )
        setDialogOpen(false)
        await fetchStreams()
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
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (streamId: string) => {
    try {
      const response = await apiFetch(`/api/streams/rtmp/${streamId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Stream supprimé avec succès', {
          description: 'Le stream RTMP a été supprimé',
          duration: 5000,
        })
        await fetchStreams()
      } else {
        toast.error('Erreur', {
          description: data.error || 'Impossible de supprimer le stream',
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

  const handleAction = async (streamId: string, action: 'start' | 'stop' | 'restart') => {
    try {
      const stream = streams.find(s => s.id === streamId)
      if (!stream) return

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
        toast.success(`Stream ${actionLabels[action]} avec succès`, {
          duration: 3000,
        })
        await fetchStreams()
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

  const renderStatusBadge = (status: RTMPStream["status"]) => {
    if (status === "active") {
      return (
        <Badge className="border border-emerald-500/30 bg-emerald-500/12 text-emerald-300">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          LIVE
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="border border-slate-600/40 bg-slate-700/30 text-muted-foreground">
        OFFLINE
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Chargement des streams RTMP...</span>
      </div>
    )
  }

  return (
    <div className={showTitle ? "p-6 space-y-6" : "space-y-6"}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        {showTitle && (
          <div>
            <h1 className="text-3xl font-bold text-white">Flux RTMP / SRT — Gestion</h1>
            <p className="mt-1 text-muted-foreground">
              Créez, modifiez ou supprimez vos streams RTMP
            </p>
          </div>
        )}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate} className="bg-primary text-primary-foreground hover:brightness-110">
              <Plus className="h-4 w-4 mr-2" />
              Créer un stream RTMP
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingStream ? 'Modifier le Stream RTMP' : 'Créer un Stream RTMP'}
              </DialogTitle>
              <DialogDescription>
                Port d&apos;entrée (encodeur) et port de sortie doivent être différents (ex: 1935 / 1936).
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du Stream</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ex: Mon Stream RTMP"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inputPort">Port Input</Label>
                  <Input
                    id="inputPort"
                    type="number"
                    value={formData.inputPort}
                    onChange={(e) => setFormData({ ...formData, inputPort: e.target.value })}
                    placeholder="1935"
                    required
                    min="1024"
                    max="65535"
                  />
                  <p className="text-xs text-muted-foreground">
                    Port pour recevoir le stream (éviter 1935 si nginx-rtmp l&apos;utilise déjà).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outputPort">Port Output</Label>
                  <Input
                    id="outputPort"
                    type="number"
                    value={formData.outputPort}
                    onChange={(e) => setFormData({ ...formData, outputPort: e.target.value })}
                    placeholder="1936"
                    required
                    min="1024"
                    max="65535"
                  />
                  <p className="text-xs text-muted-foreground">
                    Port pour redistribuer le stream RTMP
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="streamKey">Stream Key (optionnel)</Label>
                <Input
                  id="streamKey"
                  value={formData.streamKey}
                  onChange={(e) => setFormData({ ...formData, streamKey: e.target.value })}
                  placeholder="Laisser vide pour utiliser le nom du stream"
                />
                <p className="text-xs text-muted-foreground">
                  Clé personnalisée pour le stream RTMP
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {editingStream ? 'Modification...' : 'Création...'}
                    </>
                  ) : (
                    editingStream ? 'Modifier' : 'Créer'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {streams.length === 0 ? (
        <Card className="border-border/80 bg-card card-interactive">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Aucun stream RTMP. Cliquez sur « Créer un stream RTMP » pour en ajouter un.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/80 bg-card card-interactive">
          <CardHeader>
            <CardTitle>Streams RTMP ({streams.length})</CardTitle>
            <CardDescription>
              Liste de tous vos streams RTMP to RTMP
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="scrollbar-core overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Ports</TableHead>
                  <TableHead>URL entrée</TableHead>
                  <TableHead>URL sortie</TableHead>
                  <TableHead>Uptime / CPU / RAM</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {streams.map((stream) => (
                  <TableRow key={stream.id} className="table-row-core">
                    <TableCell className="font-medium">{stream.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {renderStatusBadge(stream.status)}
                        {stream.status === "active" ? <StreamHealthBadge streamId={stream.id} /> : null}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {stream.inputPort} / {stream.outputPort}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 max-w-[220px]">
                        <code className="min-w-0 flex-1 truncate rounded border border-border/80 bg-[var(--input)] px-2 py-1 text-xs text-foreground/90">
                          {stream.rtmpInputUrl}
                        </code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-7 w-7"
                          onClick={() =>
                            copyUrl(stream.rtmpInputUrl, "URL entrée", `${stream.id}-in`)
                          }
                        >
                          {copiedId === `${stream.id}-in` ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 max-w-[220px]">
                        <code className="min-w-0 flex-1 truncate rounded border border-border/80 bg-[var(--input)] px-2 py-1 text-xs text-foreground/90">
                          {stream.rtmpOutputUrl}
                        </code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-7 w-7"
                          onClick={() =>
                            copyUrl(stream.rtmpOutputUrl, "URL sortie", `${stream.id}-out`)
                          }
                        >
                          {copiedId === `${stream.id}-out` ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <span>{stream.uptime ?? "N/A"}</span>
                      {(stream.cpu != null || stream.memory) && (
                        <span className="block text-xs mt-0.5">
                          {stream.cpu != null && `${stream.cpu}% CPU`}
                          {stream.cpu != null && stream.memory && " · "}
                          {stream.memory && `${stream.memory} RAM`}
                        </span>
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
                                  Êtes-vous sûr de vouloir arrêter le stream "{stream.name}" ?
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
                                Êtes-vous sûr de vouloir redémarrer le stream "{stream.name}" ?
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(stream)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                              <AlertDialogDescription>
                                Êtes-vous sûr de vouloir supprimer le stream "{stream.name}" ?
                                Cette action est irréversible et supprimera le service systemd.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(stream.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

