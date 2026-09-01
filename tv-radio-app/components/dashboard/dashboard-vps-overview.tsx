"use client"

import { useSystemMetrics } from "@/hooks/useMetrics"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Cpu,
  HardDrive,
  MemoryStick,
  Activity,
  Server,
  Wifi,
  Clock,
  Loader2,
} from "lucide-react"

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`
  return `${bytes} B`
}

export function DashboardVpsOverview() {
  const { data: metrics, isLoading } = useSystemMetrics()

  if (isLoading) {
    return (
      <Card className="border-border/80 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Monitoring VPS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!metrics) return null

  const serviceLabels: Record<string, string> = {
    nginx: "Nginx",
    pm2: "PM2",
    icecast2: "Icecast",
  }

  return (
    <Card className="border-border/80 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Monitoring VPS
        </CardTitle>
        <CardDescription>
          Aperçu global du serveur — mise à jour toutes les 5 s
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/20 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Cpu className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CPU</p>
              <p className="text-lg font-semibold">{metrics.cpuUsage ?? 0}%</p>
              <p className="text-xs text-muted-foreground">
                charge {metrics.cpuLoad?.load1?.toFixed(1) ?? "-"} / {metrics.cpuLoad?.load5?.toFixed(1) ?? "-"} / {metrics.cpuLoad?.load15?.toFixed(1) ?? "-"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/20 p-4">
            <div className="rounded-lg bg-[#00e676]/10 p-2">
              <MemoryStick className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">RAM</p>
              <p className="text-lg font-semibold">{metrics.memory?.percentage ?? 0}%</p>
              <p className="text-xs text-muted-foreground">
                {metrics.memory?.used ?? 0} / {metrics.memory?.total ?? 0} MB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/20 p-4">
            <div className="rounded-lg bg-[var(--brand-gold)]/10 p-2">
              <HardDrive className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Disque</p>
              <p className="text-lg font-semibold">{metrics.disk?.percentage ?? 0}%</p>
              <p className="text-xs text-muted-foreground">
                {metrics.disk?.used ?? 0} / {metrics.disk?.total ?? 0} GB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/20 p-4">
            <div className="rounded-lg bg-[#a855f7]/10 p-2">
              <Clock className="h-5 w-5 text-[#a855f7]" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Uptime</p>
              <p className="text-sm font-semibold leading-tight">
                {metrics.uptime ?? "-"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
            <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Processus
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                Total {metrics.processes?.total ?? 0}
              </Badge>
              <Badge variant="outline">Running {metrics.processes?.running ?? 0}</Badge>
              <Badge variant="outline">Sleeping {metrics.processes?.sleeping ?? 0}</Badge>
              {(metrics.processes?.zombie ?? 0) > 0 && (
                <Badge variant="destructive">Zombie {metrics.processes.zombie}</Badge>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
            <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              Réseau
            </p>
            <div className="space-y-1 text-sm">
              {(metrics.network?.interfaces ?? []).slice(0, 2).map((iface) => (
                <div key={iface.name} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{iface.name}</span>
                  <span>
                    ↓ {formatBytes(iface.rxBytes)} / ↑ {formatBytes(iface.txBytes)}
                  </span>
                </div>
              ))}
              {(!metrics.network?.interfaces?.length) && (
                <p className="text-muted-foreground">—</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
          <p className="text-sm font-medium text-muted-foreground mb-2">Services</p>
          <div className="flex flex-wrap gap-2">
            {metrics.services &&
              Object.entries(metrics.services).map(([key, status]) => (
                <Badge
                  key={key}
                  variant={status === "active" ? "default" : "secondary"}
                  className={status === "active" ? "bg-green-600" : ""}
                >
                  {serviceLabels[key] ?? key} : {status === "active" ? "actif" : "inactif"}
                </Badge>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
