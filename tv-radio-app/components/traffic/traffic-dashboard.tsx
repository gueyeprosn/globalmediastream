"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MetricCard } from "@/components/shared/metric-card"
import { Section } from "@/components/shared/section"
import { LiveIndicator } from "@/components/shared/live-indicator"
import { ConfirmAction } from "@/components/shared/confirm-action"
import { useKickSrsClient } from "@/hooks/useSrs"
import { useTraffic } from "@/hooks/useTraffic"
import type { ExternalTvPoint, TrafficConnection, TrafficStream } from "@/lib/traffic/types"
import { toast } from "sonner"
import { Loader2, RefreshCw, Users, Radio, Globe2, Gauge, SatelliteDish } from "lucide-react"

function formatDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "—"
  const s = Math.floor(sec)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (d > 0) return `${d}j ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${r}s`
  if (m > 0) return `${m}m ${r}s`
  return `${r}s`
}

function formatBitrate(kbps: number): string {
  if (!kbps) return "0"
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(2)} Mbps`
  return `${Math.round(kbps)} kbps`
}

function formatClock(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return iso
  }
}

function RoleBadge({ role }: { role: "publisher" | "player" }) {
  if (role === "publisher") {
    return <Badge className="bg-primary/15 text-primary">Publisher</Badge>
  }
  return <Badge variant="outline">Player</Badge>
}

export function TrafficDashboard() {
  const { data, isLoading, isFetching, error, refetch } = useTraffic(10_000)
  const kick = useKickSrsClient()
  const [q, setQ] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | "publisher" | "player">("all")
  const [streamFilter, setStreamFilter] = useState<string>("all")

  const streams = data?.streams || []
  const connections = data?.connections || []
  const pipelines = data?.pipelines || []
  const hlsViewers = data?.hlsViewers || []
  const externalTv = data?.externalTv || []
  const summary = data?.summary

  const streamOptions = useMemo(() => {
    return streams.map((s) => ({ value: s.key, label: s.label }))
  }, [streams])

  const filteredConnections = useMemo(() => {
    const query = q.trim().toLowerCase()
    return connections.filter((c) => {
      if (roleFilter !== "all" && c.role !== roleFilter) return false
      if (streamFilter !== "all" && `${c.app}/${c.stream}` !== streamFilter) return false
      if (!query) return true
      return (
        c.ip.toLowerCase().includes(query) ||
        c.streamKey.toLowerCase().includes(query) ||
        c.app.toLowerCase().includes(query) ||
        c.cid.toLowerCase().includes(query) ||
        (c.country || "").toLowerCase().includes(query) ||
        c.protocol.toLowerCase().includes(query)
      )
    })
  }, [connections, q, roleFilter, streamFilter])

  const handleKick = (cid: string) => {
    if (!cid) return
    kick.mutate(cid, {
      onSuccess: () => {
        toast.success(`Client ${cid} expulsé`)
        void refetch()
      },
      onError: () => toast.error("Échec du kick"),
    })
  }

  if (isLoading && !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement des KPI trafic…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {data?.generatedAt ? (
            <>
              Snapshot : {formatClock(data.generatedAt)}
              {data.srsReachable ? (
                <span className="ml-2 inline-flex items-center gap-1 text-primary">
                  <LiveIndicator /> SRS OK
                </span>
              ) : (
                <span className="ml-2 text-destructive">
                  SRS offline{data.srsError ? ` (${data.srsError})` : ""}
                </span>
              )}
            </>
          ) : null}
          {error ? <span className="ml-2 text-destructive">{String(error)}</span> : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
          )}
          Rafraîchir
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          label="Publishers"
          value={summary?.publishers ?? 0}
          sub="Encodeurs connectés (SRS)"
          icon={<Radio className="h-4 w-4" />}
          tone={(summary?.publishers ?? 0) > 0 ? "live" : "default"}
        />
        <MetricCard
          label="Players SRS"
          value={summary?.players ?? 0}
          sub="Lecteurs RTMP/WebRTC"
          icon={<Users className="h-4 w-4" />}
          tone="info"
        />
        <MetricCard
          label="External TV live"
          value={summary?.externalTvLive ?? 0}
          sub={`${externalTv.length} points SRT`}
          icon={<SatelliteDish className="h-4 w-4" />}
          tone={(summary?.externalTvLive ?? 0) > 0 ? "live" : "default"}
        />
        <MetricCard
          label="IP uniques"
          value={summary?.uniqueIps ?? 0}
          sub="SRS + External TV + HLS"
          icon={<Globe2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Bitrate in / out"
          value={`${formatBitrate(summary?.bwInKbps || 0)}`}
          sub={`Sortie ${formatBitrate(summary?.bwOutKbps || 0)} · HLS ~${summary?.hlsViewersApprox ?? 0} viewers`}
          icon={<Gauge className="h-4 w-4" />}
          tone="warn"
        />
      </div>

      <Section
        title="External TV (SRT relay)"
        description="Débit et IPs lus dans srt-relay.log (tail). In = listener encodeur, Out = redistrib SRT."
      >
        <Card className="border-border/80 bg-card">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Point</TableHead>
                  <TableHead>Ports</TableHead>
                  <TableHead>Signal</TableHead>
                  <TableHead className="text-right">In</TableHead>
                  <TableHead className="text-right">Out</TableHead>
                  <TableHead className="text-right">RTT</TableHead>
                  <TableHead className="text-right">Pertes</TableHead>
                  <TableHead>Cible :out</TableHead>
                  <TableHead>IPs publisher (hits)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {externalTv.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground">
                      Aucun point External TV configuré.
                    </TableCell>
                  </TableRow>
                ) : (
                  externalTv.map((e: ExternalTvPoint) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="font-medium">{e.name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{e.id}</div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        :{e.inputPort} → :{e.outputPort}
                      </TableCell>
                      <TableCell>
                        {!e.serviceActive ? (
                          <Badge variant="outline">service off</Badge>
                        ) : e.signalLive ? (
                          <span className="inline-flex items-center gap-1.5">
                            <LiveIndicator />
                            <span className="text-sm">LIVE</span>
                          </span>
                        ) : (
                          <Badge variant="outline">idle</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {e.recvMbps > 0 ? `${e.recvMbps.toFixed(2)} Mbps` : "0"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {e.sendMbps > 0 ? `${e.sendMbps.toFixed(2)} Mbps` : "0"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {e.rttMs != null ? `${e.rttMs.toFixed(0)} ms` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {e.lossPct != null ? `${e.lossPct.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell>
                        {e.targetConnected ? (
                          <Badge className="bg-primary/15 text-primary">connecté</Badge>
                        ) : (
                          <Badge variant="outline">aucun</Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-md">
                        {e.publisherIps.length === 0 ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : (
                          <div className="space-y-0.5">
                            {e.publisherIps.slice(0, 6).map((p) => (
                              <div key={`${e.id}-${p.ip}`} className="font-mono text-[11px]">
                                {p.ip}
                                {p.country ? (
                                  <span className="text-muted-foreground"> ({p.country})</span>
                                ) : null}
                                <span className="text-muted-foreground"> · {p.hits}×</span>
                              </div>
                            ))}
                            {e.publisherIps.length > 6 ? (
                              <div className="text-[11px] text-muted-foreground">
                                +{e.publisherIps.length - 6} autres
                              </div>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      <Section
        title="Flux SRS"
        description="Heure de démarrage = connexion publisher (alive SRS). Clients = publishers + players."
      >
        <Card className="border-border/80 bg-card">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flux</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead>Démarrage</TableHead>
                  <TableHead>Uptime</TableHead>
                  <TableHead>IP publisher</TableHead>
                  <TableHead>Pays</TableHead>
                  <TableHead className="text-right">Clients</TableHead>
                  <TableHead className="text-right">Players IP</TableHead>
                  <TableHead className="text-right">In</TableHead>
                  <TableHead className="text-right">Out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {streams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-muted-foreground">
                      Aucun flux SRS signalé.
                    </TableCell>
                  </TableRow>
                ) : (
                  streams.map((s: TrafficStream) => (
                    <TableRow key={s.key}>
                      <TableCell>
                        <div className="font-medium">{s.label}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {s.app}/{s.stream}
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.publishActive ? (
                          <span className="inline-flex items-center gap-1.5">
                            <LiveIndicator />
                            <span className="text-sm">LIVE</span>
                          </span>
                        ) : (
                          <Badge variant="outline">idle</Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatClock(s.startedAt)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDuration(s.uptimeSec)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {s.publisher?.ip || "—"}
                      </TableCell>
                      <TableCell>{s.publisher?.country || "—"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {s.nPublishers}p / {s.nPlayers}v
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {s.uniquePlayerIps}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatBitrate(s.bwInKbps)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatBitrate(s.bwOutKbps)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      <Section
        title="Connexions détaillées"
        description="Chaque session SRS : IP, rôle, protocole, démarrage, débit 30s, kick."
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Filtrer IP, flux, CID, pays…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select
            value={roleFilter}
            onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}
          >
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Rôle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous rôles</SelectItem>
              <SelectItem value="publisher">Publishers</SelectItem>
              <SelectItem value="player">Players</SelectItem>
            </SelectContent>
          </Select>
          <Select value={streamFilter} onValueChange={setStreamFilter}>
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="Flux" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les flux</SelectItem>
              {streamOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground sm:ml-auto">
            {filteredConnections.length} connexion(s)
          </p>
        </div>
        <div className="space-y-3 lg:hidden">
          {filteredConnections.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune connexion SRS.</p>
          ) : (
            filteredConnections.map((c: TrafficConnection) => (
              <Card key={`m-${c.cid || `${c.ip}-${c.stream}-${c.role}-${c.aliveSec}`}`} className="border-border/80 bg-card">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <RoleBadge role={c.role} />
                        <Badge variant="outline">{c.protocol}</Badge>
                      </div>
                      <p className="truncate text-sm font-medium">{c.streamKey}</p>
                      <p className="font-mono text-xs text-muted-foreground">{c.ip || "—"} · {c.country || "—"}</p>
                    </div>
                    {c.cid ? (
                      <ConfirmAction
                        title="Expulser le publisher"
                        description={
                          <span className="block space-y-1 whitespace-pre-line text-left">
                            {`Action : Expulser le publisher
Stream : ${c.app}/${c.stream || c.streamKey || "—"}
IP : ${c.ip || "—"}
Client ID : ${c.cid}
Cette action interrompra la connexion du publisher.`}
                          </span>
                        }
                        confirmLabel="Expulser"
                        cancelLabel="Annuler"
                        destructive
                        onConfirm={() => handleKick(c.cid)}
                        trigger={
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="shrink-0 text-destructive"
                            disabled={kick.isPending}
                          >
                            Kick
                          </Button>
                        }
                      />
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Durée {formatDuration(c.uptimeSec)}</span>
                    <span className="text-right font-mono">↓ {formatBitrate(c.bwInKbps)} · ↑ {formatBitrate(c.bwOutKbps)}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        <Card className="hidden border-border/80 bg-card lg:block">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Flux</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Pays</TableHead>
                  <TableHead>Proto</TableHead>
                  <TableHead>Type client</TableHead>
                  <TableHead>Démarrage</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead className="text-right">In</TableHead>
                  <TableHead className="text-right">Out</TableHead>
                  <TableHead>CID</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConnections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-muted-foreground">
                      Aucune connexion SRS.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredConnections.map((c: TrafficConnection) => (
                    <TableRow key={c.cid || `${c.ip}-${c.stream}-${c.role}-${c.aliveSec}`}>
                      <TableCell>
                        <RoleBadge role={c.role} />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{c.streamKey}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{c.app}</div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{c.ip || "—"}</TableCell>
                      <TableCell>{c.country || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.protocol}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground" title={c.clientType}>
                        {c.clientType || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatClock(c.startedAt)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDuration(c.uptimeSec)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatBitrate(c.bwInKbps)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatBitrate(c.bwOutKbps)}
                      </TableCell>
                      <TableCell className="max-w-[90px] truncate font-mono text-[11px]" title={c.cid}>
                        {c.cid || "—"}
                      </TableCell>
                      <TableCell>
                        {c.cid ? (
                          <ConfirmAction
                            title="Expulser le publisher"
                            description={
                              <span className="block space-y-1 whitespace-pre-line text-left">
                                {`Action : Expulser le publisher
Stream : ${c.app}/${c.stream || c.streamKey || "—"}
IP : ${c.ip || "—"}
Client ID : ${c.cid}
Cette action interrompra la connexion du publisher.`}
                              </span>
                            }
                            confirmLabel="Expulser"
                            cancelLabel="Annuler"
                            destructive
                            onConfirm={() => handleKick(c.cid)}
                            trigger={
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                disabled={kick.isPending}
                              >
                                Kick
                              </Button>
                            }
                          />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      <Section
        title="Pipelines systemd (SRT / RTMP → HLS)"
        description="Heure de démarrage = ActiveEnterTimestamp du service."
      >
        <Card className="border-border/80 bg-card">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead>Démarrage</TableHead>
                  <TableHead>Uptime</TableHead>
                  <TableHead>Port in</TableHead>
                  <TableHead>HLS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pipelines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      Aucun pipeline enregistré.
                    </TableCell>
                  </TableRow>
                ) : (
                  pipelines.map((p) => (
                    <TableRow key={`${p.type}-${p.id}`}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.type.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.service}</TableCell>
                      <TableCell>
                        {p.status === "active" ? (
                          <span className="inline-flex items-center gap-1.5">
                            <LiveIndicator />
                            actif
                          </span>
                        ) : (
                          <Badge variant="outline">inactif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatClock(p.startedAt)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDuration(p.uptimeSec)}
                      </TableCell>
                      <TableCell className="font-mono">{p.inputPort ?? "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate font-mono text-[11px]" title={p.hlsUrl || ""}>
                        {p.hlsUrl || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {hlsViewers.length > 0 ? (
        <Section
          title="Viewers HLS (logs Nginx)"
          description="IPs distinctes ayant demandé un .m3u8 récemment (approximation, pas une session live)."
        >
          <Card className="border-border/80 bg-card">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stream</TableHead>
                    <TableHead className="text-right">Viewers</TableHead>
                    <TableHead>Pays</TableHead>
                    <TableHead>Échantillon IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hlsViewers.map((h) => (
                    <TableRow key={h.streamId}>
                      <TableCell className="font-medium">{h.streamId}</TableCell>
                      <TableCell className="text-right font-mono">{h.viewers}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {Object.entries(h.viewerCountries)
                          .sort((a, b) => b[1] - a[1])
                          .map(([cc, n]) => `${cc}:${n}`)
                          .join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="max-w-md truncate font-mono text-[11px]" title={h.viewerIps.join(", ")}>
                        {h.viewerIps.slice(0, 8).join(", ")}
                        {h.viewerIps.length > 8 ? ` (+${h.viewerIps.length - 8})` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Section>
      ) : null}
    </div>
  )
}
