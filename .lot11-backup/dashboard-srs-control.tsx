"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ConfirmAction } from "@/components/shared/confirm-action"
import { useSrsSessions, useKickSrsClient, useReloadSrsConfig } from "@/hooks/useSrs"
import { apiFetch } from "@/lib/api-fetch"

function getClientApp(url?: string): string {
  const clean = (url || "").replace(/^\//, "")
  if (!clean) return "-"
  return clean.split("/")[0] || "-"
}

export function DashboardSrsControl() {
  const { data, isLoading, error } = useSrsSessions()
  const kickMutation = useKickSrsClient()
  const reloadMutation = useReloadSrsConfig()

  const [tab, setTab] = useState<"publish" | "play">("publish")
  const [selectedApp, setSelectedApp] = useState<string>("all")
  const [searchStreamKey, setSearchStreamKey] = useState<string>("")
  const [creating, setCreating] = useState(false)
  const [createType, setCreateType] = useState<"rtmp" | "srt">("rtmp")
  const [name, setName] = useState("")
  const [inputPort, setInputPort] = useState("")
  const [outputPort, setOutputPort] = useState("")
  const [streamKey, setStreamKey] = useState("")
  const [srtPassphrase, setSrtPassphrase] = useState("")
  const [createdPoints, setCreatedPoints] = useState<
    Array<{
      id: string
      name: string
      type: "rtmp" | "srt"
      status: string
      service?: string
      ingestUrl: string
      playbackUrl: string
    }>
  >([])

  const clients = data?.clients || []
  const clientsParsed = clients.map((c: any) => ({
    ...c,
    app: getClientApp(c?.url),
    streamKey: String(c?.name || "-"),
    cid: String(c?.id || c?.cid || ""),
  }))

  const publishers = clientsParsed.filter((c: any) => c?.publish === true)
  const players = clientsParsed.filter((c: any) => c?.publish === false)

  const availableApps = Array.from(
    new Set(clientsParsed.map((c: any) => c.app).filter((x: string) => x && x !== "-"))
  ).sort()

  const applyFilters = (list: any[]) => {
    return list.filter((c) => {
      const byApp = selectedApp === "all" ? true : c.app === selectedApp
      const bySearch =
        searchStreamKey.trim().length === 0
          ? true
          : (c.streamKey || "").toLowerCase().includes(searchStreamKey.trim().toLowerCase())
      return byApp && bySearch
    })
  }

  const visiblePublishers = applyFilters(publishers)
  const visiblePlayers = applyFilters(players)

  const isActionLoading = kickMutation.isPending || reloadMutation.isPending

  const handleKick = async (cid: string) => {
    kickMutation.mutate(cid, {
      onSuccess: () => toast.success(`Client ${cid} expulsé (kick) ✅`),
      onError: () => toast.error("Erreur lors du kick du client"),
    })
  }

  const handleReload = () => {
    reloadMutation.mutate(undefined, {
      onSuccess: () => toast.success("SRS config reload déclenché ✅"),
      onError: () => toast.error("Erreur lors du reload de la config SRS"),
    })
  }

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Lien copié")
    } catch {
      toast.error("Impossible de copier automatiquement")
    }
  }

  const testPlaybackUrl = async (url: string) => {
    if (!/^https?:\/\//i.test(url)) {
      toast.info("Test auto disponible uniquement pour un lien HTTP/HTTPS")
      return
    }
    try {
      const response = await fetch(url, { method: "GET" })
      if (response.ok) {
        toast.success("Lecture accessible ✅")
      } else {
        toast.error(`Lecture indisponible (${response.status})`)
      }
    } catch {
      toast.error("Lecture indisponible (erreur réseau)")
    }
  }

  const controlCreatedPoint = async (id: string, action: "start" | "stop" | "restart") => {
    try {
      const response = await apiFetch(`/api/streams/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const json = await response.json()
      if (!response.ok) {
        toast.error(json?.error || "Erreur de contrôle du point de diffusion")
        return
      }
      setCreatedPoints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: json?.status || p.status } : p))
      )
      toast.success(`Point ${action === "start" ? "démarré" : action === "stop" ? "arrêté" : "redémarré"} ✅`)
    } catch {
      toast.error("Erreur réseau lors du contrôle")
    }
  }

  const handleCreate = async () => {
    if (!name.trim() || !inputPort.trim()) {
      toast.error("Nom et port d'entrée requis")
      return
    }
    if (createType === "srt" && !outputPort.trim()) {
      toast.error("Le port de sortie est requis pour un relay SRT")
      return
    }
    if (createType === "srt" && !srtPassphrase.trim()) {
      toast.error("Passphrase SRT requise")
      return
    }

    const parsedInput = Number(inputPort)
    const parsedOutput = outputPort.trim() ? Number(outputPort) : undefined
    if (Number.isNaN(parsedInput) || parsedInput <= 0) {
      toast.error("Port d'entrée invalide")
      return
    }
    if (parsedOutput != null && (Number.isNaN(parsedOutput) || parsedOutput <= 0)) {
      toast.error("Port de sortie invalide")
      return
    }

    const host = window.location.host || "stream.broadcastsn.com"
    const key = streamKey.trim() || slugify(name)
    setCreating(true)
    try {
      const response = await apiFetch("/api/streams/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: createType,
          inputPort: parsedInput,
          outputPort: parsedOutput,
          streamKey: key,
          ...(createType === "srt" ? { passphrase: srtPassphrase.trim() } : {}),
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        toast.error(json?.error || "Échec de création")
        return
      }

      const id = json?.id || slugify(name)
      const created = {
        id,
        name: name.trim(),
        type: createType,
        status: "active",
        service: json?.service,
        ingestUrl:
          json?.ingestUrl ||
          (createType === "rtmp"
            ? `rtmp://${host}:${parsedInput}/live/${key}`
            : `srt://${host}:${parsedInput}`),
        playbackUrl:
          json?.playbackUrl ||
          (createType === "rtmp"
            ? `https://${host}/rtmp-hls/${id}/stream.m3u8`
            : `srt://${host}:${parsedOutput ?? parsedInput}`),
      }
      setCreatedPoints((prev) => [created, ...prev])
      toast.success("Point de diffusion créé ✅")
      setName("")
      setInputPort("")
      setOutputPort("")
      setStreamKey("")
    } catch {
      toast.error("Erreur réseau pendant la création")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className="border-border/80 bg-card card-interactive">
      <CardHeader className="gap-3">
        <div>
          <CardTitle>SRS Sessions (Kick + Reload)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Liste les publishers + players RTMP/SRS et permet de les déconnecter.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{publishers.length} publisher(s)</Badge>
          <Badge variant="secondary">{players.length} player(s)</Badge>
          <Button size="sm" variant="outline" onClick={handleReload} disabled={isActionLoading}>
            Reload SRS config
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-6 rounded-lg border border-border/80 bg-muted/20 p-4">
          <p className="mb-3 text-sm font-semibold text-white">
            Créer un point de diffusion (RTMP/SRT)
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Type</p>
              <select
                className="w-full rounded-md border border-border/80 bg-[#0a121e] px-3 py-2 text-sm"
                value={createType}
                onChange={(e) => setCreateType(e.target.value as "rtmp" | "srt")}
              >
                <option value="rtmp">RTMP</option>
                <option value="srt">SRT (relay)</option>
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Nom du point</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: tv-sport-1"
                className="w-full rounded-md border border-border/80 bg-[#0a121e] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Port entrée</p>
              <input
                type="number"
                value={inputPort}
                onChange={(e) => setInputPort(e.target.value)}
                placeholder={createType === "rtmp" ? "ex: 1940" : "ex: 6010"}
                className="w-full rounded-md border border-border/80 bg-[#0a121e] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                Port sortie {createType === "srt" ? "(requis)" : "(optionnel)"}
              </p>
              <input
                type="number"
                value={outputPort}
                onChange={(e) => setOutputPort(e.target.value)}
                placeholder={createType === "rtmp" ? "ex: 1941" : "ex: 6011"}
                className="w-full rounded-md border border-border/80 bg-[#0a121e] px-3 py-2 text-sm"
              />
            </div>
            {createType === "rtmp" && (
              <div className="sm:col-span-2">
                <p className="mb-1 text-xs text-muted-foreground">Stream key (optionnel)</p>
                <input
                  value={streamKey}
                  onChange={(e) => setStreamKey(e.target.value)}
                  placeholder="ex: live-foot"
                  className="w-full rounded-md border border-border/80 bg-[#0a121e] px-3 py-2 text-sm"
                />
              </div>
            )}
            {createType === "srt" && (
              <div className="sm:col-span-2">
                <p className="mb-1 text-xs text-muted-foreground">Passphrase SRT (obligatoire)</p>
                <input
                  type="password"
                  autoComplete="off"
                  value={srtPassphrase}
                  onChange={(e) => setSrtPassphrase(e.target.value)}
                  placeholder="Même passphrase encodeur / FFmpeg"
                  className="w-full rounded-md border border-border/80 bg-[#0a121e] px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={handleCreate} disabled={creating} className="bg-primary text-primary-foreground hover:brightness-110">
              {creating ? "Création..." : "Créer le point"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Le service systemd est créé et démarré automatiquement.
            </p>
          </div>

          {createdPoints.length > 0 && (
            <div className="mt-4 space-y-3">
              {createdPoints.map((p) => (
                <div key={p.id} className="rounded-md border border-border/80 bg-[#0c1625] p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{p.type.toUpperCase()}</Badge>
                    <span className="font-medium">{p.name}</span>
                    <Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p>
                      <span className="font-semibold">Lien d'envoi:</span>{" "}
                      <span className="font-mono">{p.ingestUrl}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Lien de lecture:</span>{" "}
                      <span className="font-mono">{p.playbackUrl}</span>
                    </p>
                  </div>
                  <div className="mt-3 border-t border-border/80/80 pt-3">
                    <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" className="w-full" onClick={() => copyToClipboard(p.ingestUrl)}>
                      Copier envoi
                    </Button>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => copyToClipboard(p.playbackUrl)}>
                      Copier lecture
                    </Button>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => testPlaybackUrl(p.playbackUrl)}>
                      Tester lecture
                    </Button>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => window.open(p.playbackUrl, "_blank")}>
                      Ouvrir lecture
                    </Button>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => controlCreatedPoint(p.id, "start")}>
                      Démarrer
                    </Button>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => controlCreatedPoint(p.id, "stop")}>
                      Arrêter
                    </Button>
                    <Button size="sm" variant="outline" className="col-span-2 w-full" onClick={() => controlCreatedPoint(p.id, "restart")}>
                      Redémarrer
                    </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">Erreur: {String(error)}</p>
        ) : publishers.length === 0 && players.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">
            Aucun client RTMP/SRS actif pour le moment.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">App RTMP</p>
                <select
                  className="w-full rounded-md border border-border/80 bg-[#0a121e] px-3 py-2 text-sm text-foreground"
                  value={selectedApp}
                  onChange={(e) => setSelectedApp(e.target.value)}
                >
                  <option value="all">Toutes</option>
                  {availableApps.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <p className="mb-1 text-xs text-muted-foreground">Stream key (nom)</p>
                <input
                  value={searchStreamKey}
                  onChange={(e) => setSearchStreamKey(e.target.value)}
                  placeholder="ex: ttv / sport / event-live"
                  className="w-full rounded-md border border-border/80 bg-[#0a121e] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={tab === "publish" ? "default" : "outline"}
                onClick={() => setTab("publish")}
              >
                Publishers
              </Button>
              <Button
                size="sm"
                variant={tab === "play" ? "default" : "outline"}
                onClick={() => setTab("play")}
              >
                Players
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Stream key</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead className="text-right">CID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tab === "publish" ? visiblePublishers : visiblePlayers).map((c: any) => {
                  return (
                    <TableRow key={c?.cid || c?.id || c?.stream || Math.random()}>
                      <TableCell>{c.app}</TableCell>
                      <TableCell className="font-medium">{c.streamKey}</TableCell>
                      <TableCell>{c?.type || "-"}</TableCell>
                      <TableCell>{c?.ip || "-"}</TableCell>
                      <TableCell className="text-right font-mono">{String(c?.id || "-")}</TableCell>
                      <TableCell className="text-right">
                        <ConfirmAction
                          title="Expulser le publisher"
                          description={
                            <span className="block space-y-1 whitespace-pre-line text-left">
                              {`Action : Expulser le publisher
Stream : ${c.app}/${c.streamKey || "—"}
IP : ${c?.ip || "—"}
Client ID : ${String(c?.cid || c?.id || "—")}
Cette action interrompra la connexion du publisher.`}
                            </span>
                          }
                          confirmLabel="Expulser"
                          cancelLabel="Annuler"
                          destructive
                          onConfirm={() => handleKick(String(c?.cid || c?.id))}
                          trigger={
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={isActionLoading}
                            >
                              Kick
                            </Button>
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            <p className="text-xs text-muted-foreground">
              Le “kick” se base sur le <span className="font-mono">cid/id</span> retourné par l’API SRS.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

