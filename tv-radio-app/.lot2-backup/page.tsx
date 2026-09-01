"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog"
import { RecordingStreamCard } from "@/components/RecordingStreamCard"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { useStreams } from "@/hooks/useStreams"
import {
  FFMPEG_SRT_DASHBOARD_IDS,
  ffmpegSrtPipelineLiveMapFromStreams,
} from "@/lib/dashboard-stream-rows"
import { PageHeader } from "@/components/shell/page-header"

type RecordingFile = {
  id: string
  name: string
  sizeBytes: number
  modifiedAt: number
  downloadUrl: string
  deleteUrl?: string
}

type ActiveRec = {
  streamId: string
  pid: number
  file: string
  startedAt: number
}

type RecordingsResponse = {
  recordings: RecordingFile[]
  active: ActiveRec[]
}

type RecordableSource = {
  id: string
  name: string
  type: "srt" | "rtmp"
  hlsUrl: string
  inputPort?: number
}

function isLiveForRecording(meta: Record<string, unknown> | undefined): boolean {
  if (!meta) return true
  if (meta.signalState === "offline") return false
  const st = meta.status as string | undefined
  if (st === "inactive" || st === "stopped" || st === "error") return false
  return true
}

function portLabel(src: RecordableSource): string {
  if (src.inputPort == null) return "—"
  return src.type === "rtmp" ? `:${src.inputPort} TCP` : `:${src.inputPort} UDP`
}

function fmtBytes(b: number) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`
  return `${Math.round(b / 1e3)} KB`
}

async function downloadRecordingFile(downloadUrl: string, filename: string) {
  try {
    const res = await apiFetch(downloadUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const u = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = u
    a.download = filename || "recording"
    a.click()
    URL.revokeObjectURL(u)
    toast.success("Téléchargement démarré")
  } catch {
    toast.error("Téléchargement impossible (vérifiez la session)")
  }
}

export default function RecordingsPage() {
  const [data, setData] = useState<RecordingsResponse>({ recordings: [], active: [] })
  const [sources, setSources] = useState<RecordableSource[]>([])
  const [tab, setTab] = useState<"in-progress" | "done" | "scheduled">("in-progress")
  const [busy, setBusy] = useState<string | null>(null)
  const [playFileName, setPlayFileName] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<RecordingFile | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<RecordingFile | null>(null)
  const [fileBusy, setFileBusy] = useState<string | null>(null)
  const { data: streams = [] } = useStreams()

  const playbackUrl = (fileName: string) =>
    `/api/recordings/${encodeURIComponent(fileName)}/stream`

  const streamMetaById = useMemo(() => {
    const m = new Map<string, Record<string, unknown>>()
    for (const s of streams as Record<string, unknown>[]) {
      const id = s.id as string
      if (id) m.set(id, s)
    }
    return m
  }, [streams])

  /** Même règle que le dashboard : ToubaTV + External TV 1–3 via systemd / HLS, pas seulement signalState. */
  const ffmpegLiveById = useMemo(
    () =>
      ffmpegSrtPipelineLiveMapFromStreams(
        streams as ReadonlyArray<{ id?: string; status?: string; signalState?: string }>
      ),
    [streams]
  )

  const isSourceLiveForRecord = useCallback(
    (src: RecordableSource) => {
      if (FFMPEG_SRT_DASHBOARD_IDS.includes(src.id)) {
        const meta = streamMetaById.get(src.id)
        if (!meta) return true
        const st = meta.status as string | undefined
        if (st === "stopped" || st === "inactive" || st === "error") return false
        return Boolean(ffmpegLiveById[src.id]) || st === "running" || st === "active"
      }
      return isLiveForRecording(streamMetaById.get(src.id))
    },
    [ffmpegLiveById, streamMetaById]
  )

  const loadSources = useCallback(async () => {
    try {
      const res = await apiFetch("/api/recordings/sources", { cache: "no-store" })
      const j = await res.json()
      setSources(Array.isArray(j.sources) ? j.sources : [])
    } catch {
      setSources([])
    }
  }, [])

  const load = async () => {
    const res = await apiFetch("/api/recordings", { cache: "no-store" })
    const json = (await res.json()) as RecordingsResponse
    setData(json)
  }

  useEffect(() => {
    load()
    loadSources()
    const t = setInterval(load, 5000)
    const t2 = setInterval(loadSources, 30000)
    return () => {
      clearInterval(t)
      clearInterval(t2)
    }
  }, [loadSources])

  const startRec = async (streamId: string) => {
    setBusy(streamId)
    try {
      const res = await apiFetch("/api/recordings/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Erreur start")
      toast.success("Enregistrement demarre")
      await load()
      await loadSources()
    } catch (e: any) {
      toast.error(e?.message || "Erreur")
    } finally {
      setBusy(null)
    }
  }

  const stopRec = async (streamId: string) => {
    setBusy(streamId)
    try {
      const res = await apiFetch("/api/recordings/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Erreur stop")
      toast.success("Enregistrement arrete")
      await load()
    } catch (e: any) {
      toast.error(e?.message || "Erreur")
    } finally {
      setBusy(null)
    }
  }

  const recordAll = async () => {
    if (sources.length === 0) {
      toast.error("Aucune source enregistrable")
      return
    }
    await Promise.all(sources.map((s) => startRec(s.id)))
  }
  const stopAll = async () => Promise.all(data.active.map((a) => stopRec(a.streamId)))
  const activeMap = useMemo(() => new Map(data.active.map((a) => [a.streamId, a])), [data])

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Enregistrements"
          description={`${data.active.length} actif(s) — conteneur MKV (FFmpeg -c copy). Sources HLS via GET /api/recordings/sources.`}
          actions={
            <>
              <Button onClick={recordAll} className="bg-primary text-primary-foreground">
                Record all
              </Button>
              <Button onClick={stopAll} variant="destructive">
                Stop all
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground md:col-span-2">
              Chargement des sources ou aucun flux HLS enregistrable (créez un flux SRT→HLS ou RTMP→HLS).
            </p>
          ) : (
            sources.map((src) => {
              const rec = activeMap.get(src.id)
              const live = isSourceLiveForRecord(src)
              return (
                <RecordingStreamCard
                  key={src.id}
                  streamName={src.name}
                  protocol={src.type.toUpperCase()}
                  port={portLabel(src)}
                  isRecording={Boolean(rec)}
                  isStreamLive={live}
                  startedAt={rec?.startedAt}
                  actionsLocked={Boolean(busy)}
                  onStart={() => startRec(src.id)}
                  onStop={() => stopRec(src.id)}
                />
              )
            })
          )}
        </div>

        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle>Fichiers</CardTitle>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "in-progress", label: "En cours" },
                { id: "done", label: "Termines" },
                { id: "scheduled", label: "Planifies" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as "in-progress" | "done" | "scheduled")}
                  className={`rounded-md px-3 py-1.5 text-sm transition ${tab === t.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-slate-800/60"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {tab === "in-progress" &&
              (data.active.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun enregistrement en cours.</p>
              ) : (
                data.active.map((r) => (
                  <div key={r.streamId} className="rounded-lg border border-border/80 bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-foreground">{r.file}</p>
                      <Badge className="bg-red-500/15 text-red-300">REC - FFmpeg PID {r.pid}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="destructive" onClick={() => stopRec(r.streamId)} disabled={busy === r.streamId}>
                        Stop
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => setPlayFileName(r.file)}
                      >
                        Lire
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => downloadRecordingFile(`/api/recordings/${encodeURIComponent(r.file)}/download`, r.file)}
                        disabled={Boolean(fileBusy)}
                      >
                        Télécharger
                      </Button>
                    </div>
                  </div>
                ))
              ))}

            {tab === "done" &&
              (data.recordings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun fichier termine.</p>
              ) : (
                data.recordings.map((f) => (
                  <div key={f.id} className="rounded-lg border border-border/80 bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-foreground">{f.name}</p>
                      <Badge className="bg-emerald-500/15 text-emerald-300">TERMINE</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{fmtBytes(f.sizeBytes)} - {new Date(f.modifiedAt).toLocaleString("fr-FR")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => setPlayFileName(f.name)}
                        disabled={fileBusy === f.name}
                      >
                        Lire
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => downloadRecordingFile(f.downloadUrl, f.name)}
                        disabled={fileBusy === f.name}
                      >
                        Télécharger
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => {
                          setRenameTarget(f)
                          setRenameValue(f.name)
                        }}
                        disabled={fileBusy === f.name}
                      >
                        Renommer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/40 text-red-300 hover:bg-destructive/10"
                        type="button"
                        onClick={() => setDeleteTarget(f)}
                        disabled={fileBusy === f.name}
                      >
                        Supprimer
                      </Button>
                    </div>
                  </div>
                ))
              ))}

            {tab === "scheduled" && <p className="text-sm text-muted-foreground">Aucune planification active.</p>}
          </CardContent>
        </Card>

        <Dialog open={Boolean(playFileName)} onOpenChange={(o) => !o && setPlayFileName(null)}>
          <DialogContent className="max-w-4xl border-border/80 bg-card sm:max-w-4xl" showCloseButton>
            <DialogHeader>
              <DialogTitle className="text-foreground">Lecture</DialogTitle>
              <DialogDescription className="font-mono text-xs text-muted-foreground">{playFileName}</DialogDescription>
            </DialogHeader>
            {playFileName ? (
              <video
                key={playFileName}
                className="aspect-video w-full rounded-md bg-black"
                controls
                playsInline
                preload="metadata"
                src={playbackUrl(playFileName)}
              >
                Lecture impossible dans ce navigateur (MKV).
              </video>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setPlayFileName(null)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(renameTarget)}
          onOpenChange={(o) => {
            if (!o) {
              setRenameTarget(null)
              setRenameValue("")
            }
          }}
        >
          <DialogContent className="border-border/80 bg-card">
            <DialogHeader>
              <DialogTitle className="text-foreground">Renommer</DialogTitle>
              <DialogDescription>Nouveau nom (lettres, chiffres, . _ - et extension .mkv).</DialogDescription>
            </DialogHeader>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="font-mono text-sm"
              autoComplete="off"
            />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setRenameTarget(null)}>
                Annuler
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  if (!renameTarget) return
                  const newName = renameValue.trim()
                  setFileBusy(renameTarget.name)
                  try {
                    const res = await apiFetch(`/api/recordings/${encodeURIComponent(renameTarget.name)}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ newName }),
                    })
                    const j = await res.json()
                    if (!res.ok) throw new Error(j?.error || "Renommage refusé")
                    toast.success("Fichier renommé")
                    setRenameTarget(null)
                    setRenameValue("")
                    await load()
                  } catch (e: unknown) {
                    toast.error(e instanceof Error ? e.message : "Erreur")
                  } finally {
                    setFileBusy(null)
                  }
                }}
              >
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent className="border-border/80 bg-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Supprimer le fichier ?</AlertDialogTitle>
              <AlertDialogDescription className="font-mono text-muted-foreground">
                {deleteTarget?.name} — cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  if (!deleteTarget) return
                  const name = deleteTarget.name
                  setFileBusy(name)
                  try {
                    const url = deleteTarget.deleteUrl ?? `/api/recordings/${encodeURIComponent(name)}`
                    const res = await apiFetch(url, { method: "DELETE" })
                    const j = await res.json().catch(() => ({}))
                    if (!res.ok) throw new Error((j as { error?: string }).error || "Suppression refusée")
                    toast.success("Fichier supprimé")
                    setDeleteTarget(null)
                    await load()
                  } catch (e: unknown) {
                    toast.error(e instanceof Error ? e.message : "Erreur")
                  } finally {
                    setFileBusy(null)
                  }
                }}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  )
}
