"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useStreams } from "@/hooks/useStreams"
import { useStartStream, useStopStream, useRestartStream } from "@/hooks/useStreams"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Play, Pause, RotateCcw, Radio, Video, Music, ExternalLink, Tv, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Stream } from "@/types/streams"
import { cn } from "@/lib/utils"

const PROTOCOL_LINKS = [
  { path: "/srt", label: "SRT", icon: Radio },
  { path: "/rtmp", label: "RTMP", icon: Video },
  { path: "/icecast", label: "Icecast", icon: Music },
] as const

function getManageLink(stream: Stream): string {
  const p = stream.protocol || (stream as { type?: string }).type
  if (p === "srt") return "/srt"
  if (p === "rtmp") return "/rtmp"
  return "/icecast"
}

export function DashboardStreamControl() {
  const { data: streams = [], isLoading } = useStreams()
  const startMutation = useStartStream()
  const stopMutation = useStopStream()
  const restartMutation = useRestartStream()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "running" | "stopped">("all")

  const counts = {
    srt: streams.filter((s: Stream) => (s.protocol || (s as { type?: string }).type) === "srt").length,
    rtmp: streams.filter((s: Stream) => (s.protocol || (s as { type?: string }).type) === "rtmp").length,
    icecast: streams.filter((s: Stream) => (s.protocol || (s as { type?: string }).type) === "icecast").length,
  }

  const handleAction = async (streamId: string, action: "start" | "stop" | "restart") => {
    const mutations = { start: startMutation, stop: stopMutation, restart: restartMutation }
    const mutation = mutations[action]
    mutation.mutate(streamId, {
      onSuccess: () => {
        const labels = { start: "démarré", stop: "arrêté", restart: "redémarré" }
        toast.success(`Flux ${labels[action]} avec succès`)
      },
      onError: () => toast.error("Erreur lors de l'action"),
    })
  }

  const isActionLoading = startMutation.isPending || stopMutation.isPending || restartMutation.isPending
  const filteredStreams = useMemo(
    () =>
      streams.filter((stream: Stream) => {
        const streamStatus = stream.status === "running" ? "running" : "stopped"
        const matchStatus = statusFilter === "all" ? true : streamStatus === statusFilter
        const matchSearch = stream.name.toLowerCase().includes(search.toLowerCase())
        return matchStatus && matchSearch
      }),
    [streams, statusFilter, search]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-white">
          Contrôle des flux
        </h2>
        <Link
          href="/watch"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border/80 bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-slate-800/70"
        >
          <Tv className="h-4 w-4" />
          Voir le direct (Touba TV)
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PROTOCOL_LINKS.map(({ path, label, icon: Icon }) => {
          const count = label === "SRT" ? counts.srt : label === "RTMP" ? counts.rtmp : counts.icecast
          return (
            <Link key={path} href={path}>
              <Card className="card-interactive h-full cursor-pointer border-border/80 bg-card transition-colors hover:border-[var(--primary)]/60">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-semibold text-white">{label}</span>
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <Card className="border-border/80 bg-card card-interactive">
        <CardHeader>
          <CardTitle>Tous les flux</CardTitle>
          <p className="text-sm text-muted-foreground">
            Démarrer, arrêter ou redémarrer un flux ; gérer depuis les pages dédiées.
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un flux..."
              className="max-w-md border-border/80 bg-[var(--input)]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={statusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("all")} className={statusFilter === "all" ? "bg-primary text-primary-foreground" : "border-border/80 bg-muted/40 text-foreground/90"}>
                Tous
              </Button>
              <Button
                variant={statusFilter === "running" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("running")}
                className={statusFilter === "running" ? "bg-[var(--brand-green)] text-[#03160d]" : "border-border/80 bg-muted/40 text-foreground/90"}
              >
                En cours
              </Button>
              <Button
                variant={statusFilter === "stopped" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("stopped")}
                className={statusFilter === "stopped" ? "bg-slate-600 text-white" : "border-border/80 bg-muted/40 text-foreground/90"}
              >
                Arrêtés
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : streams.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Aucun flux configuré. Ajoutez des streams depuis les onglets SRT, RTMP ou Icecast.
            </p>
          ) : filteredStreams.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Aucun flux ne correspond aux filtres actuels.
            </p>
          ) : (
            <div className="scrollbar-core overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Protocole</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStreams.map((stream: Stream) => {
                    const protocol = stream.protocol || (stream as { type?: string }).type
                    const isRunning = stream.status === "running"
                    const canControl = protocol !== "icecast"

                    return (
                      <TableRow key={stream.id} className="table-row-core">
                        <TableCell className="font-medium">{stream.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">
                            {String(protocol)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              isRunning
                                ? "bg-green-500/12 text-green-200 border border-green-500/30"
                                : "bg-slate-500/12 text-foreground/90 border border-slate-500/30"
                            )}
                          >
                            {isRunning ? "En cours" : "Arrêté"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canControl && (
                              <>
                                {isRunning ? (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive hover:text-destructive"
                                        disabled={isActionLoading}
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
                                        <AlertDialogAction onClick={() => handleAction(stream.id, "stop")}>
                                          Arrêter
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleAction(stream.id, "start")}
                                    disabled={isActionLoading}
                                  >
                                    <Play className="h-4 w-4 mr-1" />
                                    Démarrer
                                  </Button>
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost" disabled={isActionLoading}>
                                      <RotateCcw className="h-4 w-4 mr-1" />
                                      Redémarrer
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
                                      <AlertDialogAction onClick={() => handleAction(stream.id, "restart")}>
                                        Redémarrer
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                            <Link href={getManageLink(stream)}>
                              <Button size="sm" variant="outline">
                                Gérer
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
