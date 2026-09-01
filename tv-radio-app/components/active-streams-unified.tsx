"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Copy, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
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

type StreamType = "rtmp" | "srt" | "icecast" | string

interface UnifiedStream {
  id: string
  name: string
  type: StreamType
  status: "active" | "inactive" | "error" | string
  service?: string
  rtmpInputUrl?: string
  rtmpOutputUrl?: string
  srtInputUrl?: string
  srtOutputUrl?: string
  hlsUrl?: string
  deletable?: boolean
  signalState?: "live" | "frozen" | "offline"
  hlsAgeSec?: number
}

function valueOrDash(value?: string) {
  return value && value.trim().length > 0 ? value : "-"
}

export function ActiveStreamsUnified() {
  const [streams, setStreams] = useState<UnifiedStream[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchStreams = async () => {
    try {
      const response = await apiFetch("/api/streams", { cache: "no-store" })
      if (!response.ok) throw new Error("Impossible de charger les flux")
      const data = await response.json()
      setStreams((data.streams || []) as UnifiedStream[])
    } catch (error: any) {
      toast.error("Erreur", {
        description: error.message || "Impossible de charger les flux actifs",
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

  const activeStreams = useMemo(
    () => streams.filter((s) => s.type === "rtmp" || s.type === "srt"),
    [streams]
  )

  const copyText = async (value: string, id: string, label: string) => {
    if (!value || value === "-") return
    try {
      await navigator.clipboard.writeText(value)
      setCopiedId(id)
      toast.success(`${label} copié`)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      toast.error("Copie impossible")
    }
  }

  const removeStream = async (stream: UnifiedStream) => {
    try {
      const endpoint =
        stream.type === "rtmp"
          ? `/api/streams/rtmp/${stream.id}`
          : `/api/streams/srt/${stream.id}`
      const response = await apiFetch(endpoint, { method: "DELETE" })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Suppression impossible")
      }
      toast.success("Flux retiré avec succès")
      await fetchStreams()
    } catch (error: any) {
      toast.error("Erreur", {
        description: error.message || "Impossible de retirer ce flux",
      })
    }
  }

  const renderCopyCell = (value: string, keyId: string, label: string) => (
    <div className="flex items-center gap-1 max-w-[260px]">
      <code className="min-w-0 flex-1 truncate rounded border border-border/80 bg-[var(--input)] px-2 py-1 text-xs text-foreground/90">
        {value}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        disabled={value === "-"}
        onClick={() => copyText(value, keyId, label)}
      >
        {copiedId === keyId ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  )

  const renderSignalBadge = (stream: UnifiedStream) => {
    if (stream.signalState === "live") {
      return (
        <Badge className="border border-emerald-500/30 bg-emerald-500/12 text-emerald-300">
          Signal LIVE
        </Badge>
      )
    }
    if (stream.signalState === "frozen") {
      return (
        <Badge className="border border-amber-500/30 bg-amber-500/12 text-amber-300">
          Signal figé {stream.hlsAgeSec != null ? `(${stream.hlsAgeSec}s)` : ""}
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="border border-slate-600/40 bg-slate-700/30 text-muted-foreground">
        Hors-ligne
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card className="border-border/80 bg-card">
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span>Chargement des flux actifs...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/80 bg-card card-interactive">
      <CardHeader>
        <CardTitle>Flux actifs unifiés (RTMP + SRT)</CardTitle>
        <CardDescription>
          Liens encodeur et lecture prêts à copier (RTMP, SRT, HLS).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activeStreams.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Aucun flux RTMP/SRT disponible.</p>
        ) : (
          <div className="scrollbar-core overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flux</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Lien encodeur</TableHead>
                  <TableHead>Lecture HLS</TableHead>
                  <TableHead>Lecture SRT</TableHead>
                  <TableHead>Lecture RTMP</TableHead>
                  <TableHead>Signal</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeStreams.map((stream) => {
                  const encoder = stream.type === "srt" ? valueOrDash(stream.srtInputUrl) : valueOrDash(stream.rtmpInputUrl)
                  const hls = valueOrDash(stream.hlsUrl)
                  const srt = valueOrDash(stream.srtOutputUrl)
                  const rtmp = valueOrDash(stream.rtmpOutputUrl || stream.rtmpInputUrl)
                  const isLive = stream.status === "active"

                  return (
                    <TableRow key={stream.id} className="table-row-core">
                      <TableCell className="font-medium">
                        <p>{stream.name}</p>
                        {stream.service && <p className="text-xs text-muted-foreground">{stream.service}</p>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase">{stream.type}</Badge>
                      </TableCell>
                      <TableCell>
                        {isLive ? (
                          <Badge className="border border-emerald-500/30 bg-emerald-500/12 text-emerald-300">LIVE</Badge>
                        ) : (
                          <Badge variant="secondary" className="border border-slate-600/40 bg-slate-700/30 text-muted-foreground">
                            OFFLINE
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{renderCopyCell(encoder, `${stream.id}-enc`, "Lien encodeur")}</TableCell>
                      <TableCell>{renderCopyCell(hls, `${stream.id}-hls`, "Lien HLS")}</TableCell>
                      <TableCell>{renderCopyCell(srt, `${stream.id}-srt`, "Lien SRT")}</TableCell>
                      <TableCell>{renderCopyCell(rtmp, `${stream.id}-rtmp`, "Lien RTMP")}</TableCell>
                      <TableCell>{renderSignalBadge(stream)}</TableCell>
                      <TableCell>
                        {stream.deletable ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                Retirer
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Retirer ce flux ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Le flux "{stream.name}" sera retiré de la plateforme.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeStream(stream)}>
                                  Confirmer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
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
  )
}

