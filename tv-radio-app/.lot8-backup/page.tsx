"use client"

import { useMemo } from "react"
import { useSrsStats } from "@/hooks/useSrsStats"
import { useStreams } from "@/hooks/useStreams"
import { useSystemStats } from "@/hooks/useSystemStats"
import { MiniChart } from "@/components/MiniChart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Database, Server } from "lucide-react"
import { StreamMonitorAdvanced } from "@/components/stream-monitor-advanced"
import { isSrsStreamLive } from "@/lib/dashboard-stream-rows"
import { useSystemHealth } from "@/hooks/useSystemHealth"
import { HealthBadge, ResourceGauge } from "@/components/health/ResourceGauge"
import { PageHeader } from "@/components/shell/page-header"
import { Section } from "@/components/shared/section"
import { MetricCard } from "@/components/shared/metric-card"
import { LiveIndicator } from "@/components/shared/live-indicator"

type AppStreamRow = {
  id?: string
  name?: string
  type?: string
  protocol?: string
  status?: string
  inputPort?: number
  hlsUrl?: string
}

export default function MonitoringPage() {
  const { streams, history, ok } = useSrsStats()
  const { data: appStreams = [] } = useStreams()
  const system = useSystemStats()
  const { health } = useSystemHealth()
  const memPct = system.memTotal > 0 ? (system.memUsed / system.memTotal) * 100 : 0
  const srsUptime = health?.metrics?.dockerUptime?.srs
  const pm2Ok = health?.components?.find((c) => c.id === "pm2")?.level === "ok"
  const liveStreams = useMemo(() => streams.filter((s) => isSrsStreamLive(s)), [streams])

  const ffmpegPipelinesLive = useMemo(() => {
    return (appStreams as AppStreamRow[]).filter((s) => {
      const t = (s.type || s.protocol || "").toString().toLowerCase()
      if (t !== "srt" && t !== "rtmp") return false
      const st = (s.status || "").toString().toLowerCase()
      if (st !== "running") return false
      return typeof s.inputPort === "number"
    })
  }, [appStreams])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring"
        description="SRS, système et streams en temps réel"
        actions={health ? <HealthBadge status={health.status} score={health.score} /> : null}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard
          label="SRS API :1985"
          value={ok ? "200 OK" : "OFFLINE"}
          sub="Statut API SRS"
          tone={ok ? "live" : "danger"}
        />
        <MetricCard
          label="PM2 oceanfm-app"
          value={pm2Ok ? "ONLINE" : "OFFLINE"}
          sub="Processus applicatif"
          tone={pm2Ok ? "live" : "danger"}
        />
        <MetricCard
          label="Uptime Docker SRS"
          value={srsUptime || "—"}
          sub="ossrs/srs:6"
          tone="warn"
        />
      </div>

      <Section title="Ressources">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="border-border/80 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4" />
                CPU
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResourceGauge label="Utilisation" value={system.cpu} kind="cpu" />
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                RAM
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResourceGauge
                label="Utilisation"
                value={memPct}
                display={`${system.memUsed.toFixed(1)}/${system.memTotal.toFixed(1)} GB`}
                kind="ram"
              />
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" />
                Disk /srv
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResourceGauge
                label="Utilisation"
                value={system.diskPercent}
                display={`${system.diskUsed.toFixed(1)} GB`}
                kind="disk"
              />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Tendances">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            { label: "Bitrate total entrant", data: history.bitrate, color: "var(--primary)" },
            { label: "Clients HLS total", data: history.clients, color: "var(--chart-2)" },
            {
              label: "CPU Serveur",
              data: Array.from({ length: 30 }, () => system.cpu),
              color: "var(--chart-4)",
            },
            {
              label: "Erreurs SRS/PM2",
              data: Array.from({ length: 30 }, () => (ok ? 0 : 100)),
              color: "var(--destructive)",
            },
          ].map((c) => (
            <Card key={c.label} className="border-border/80 bg-card">
              <CardHeader>
                <CardTitle className="text-base">{c.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <MiniChart data={c.data.slice(-30)} color={c.color} />
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Streams live" description="SRS natifs et pipelines FFmpeg systemd">
        <Card className="border-border/80 bg-card">
          <CardContent className="space-y-4 pt-6">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Via SRS (API :1985)
              </p>
              {liveStreams.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun flux avec bitrate entrant SRS.</p>
              ) : (
                <div className="space-y-2">
                  {liveStreams.map((s) => (
                    <div
                      key={`${s.app}-${s.stream}`}
                      className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/30 p-3"
                    >
                      <div>
                        <p className="font-medium text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.app}/{s.stream}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <LiveIndicator />
                        <Badge variant="outline">{s.bw_in_kbps} kbps</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pipelines FFmpeg (SRT/RTMP → HLS)
              </p>
              {ffmpegPipelinesLive.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun flux systemd SRT/RTMP actif dans la liste API.
                </p>
              ) : (
                <div className="space-y-2">
                  {ffmpegPipelinesLive.map((s) => (
                    <div
                      key={String(s.id)}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/30 p-3"
                    >
                      <div>
                        <p className="font-medium text-foreground">{s.name || s.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {(s.type || s.protocol || "").toString().toUpperCase()} · entrée :{s.inputPort}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-primary/15 text-primary">SERVICE ACTIF</Badge>
                        {s.hlsUrl ? (
                          <Badge
                            variant="outline"
                            className="max-w-[220px] truncate font-mono text-[10px]"
                            title={s.hlsUrl}
                          >
                            HLS
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section
        title="Métriques détaillées"
        description="ffprobe, IP publisher, viewers HLS, répartition pays"
      >
        <Card className="overflow-hidden border-border/80 bg-card">
          <CardContent className="p-0 sm:p-2">
            <StreamMonitorAdvanced showTitle={false} />
          </CardContent>
        </Card>
      </Section>
    </div>
  )
}
