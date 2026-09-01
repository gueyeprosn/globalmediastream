"use client"

import { useMemo, useState } from "react"
import { useAppStore } from "@/stores/useAppStore"
import { AlertTriangle, X, CheckCircle, Info } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function AlertsPanel() {
  const { alerts, acknowledgeAlert } = useAppStore()
  const [filter, setFilter] = useState<"all" | "error" | "warning" | "info">("all")
  const unacknowledged = alerts.filter((a) => !a.acknowledged)

  const counts = useMemo(
    () => ({
      all: unacknowledged.length,
      error: unacknowledged.filter((a) => a.type === "error").length,
      warning: unacknowledged.filter((a) => a.type === "warning").length,
      info: unacknowledged.filter((a) => a.type === "info").length,
    }),
    [unacknowledged]
  )

  const filteredAlerts = unacknowledged
    .filter((a) => (filter === "all" ? true : a.type === filter))
    .slice(0, 8)

  const getIcon = (type: string) => {
    switch (type) {
      case "error":
        return AlertTriangle
      case "warning":
        return AlertTriangle
      case "info":
        return Info
      default:
        return Info
    }
  }

  const getColor = (type: string) => {
    switch (type) {
      case "error":
        return "text-red-200 bg-red-500/12 border-red-500/30"
      case "warning":
        return "text-yellow-200 bg-yellow-500/12 border-yellow-500/30"
      case "info":
        return "text-foreground bg-cyan-500/12 border-cyan-500/30"
      default:
        return "text-foreground/90 bg-slate-500/12 border-slate-500/30"
    }
  }

  if (unacknowledged.length === 0) {
    return (
      <Card className="border-border/80 bg-card">
        <CardContent className="py-12 text-center">
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <CheckCircle className="h-5 w-5 text-[var(--brand-green)]" />
            <p>Aucune alerte active</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/80 bg-card">
      <CardHeader>
        <CardTitle>Alertes actives</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")} className={cn(filter === "all" ? "bg-primary text-primary-foreground" : "border-border/80 bg-muted/40 text-foreground/90")}>
            Toutes ({counts.all})
          </Button>
          <Button
            variant={filter === "error" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("error")}
            className={cn(filter === "error" ? "bg-[var(--destructive)] text-white" : "border-border/80 bg-muted/40 text-[var(--destructive)]")}
          >
            Critiques ({counts.error})
          </Button>
          <Button
            variant={filter === "warning" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("warning")}
            className={cn(filter === "warning" ? "bg-[var(--brand-gold)] text-[#1d1300]" : "border-border/80 bg-muted/40 text-amber-400")}
          >
            Avertissements ({counts.warning})
          </Button>
          <Button
            variant={filter === "info" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("info")}
            className={cn(filter === "info" ? "bg-primary text-primary-foreground" : "border-border/80 bg-muted/40 text-primary")}
          >
            Infos ({counts.info})
          </Button>
        </div>

        {filteredAlerts.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Aucune alerte dans ce filtre.
          </p>
        ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const Icon = getIcon(alert.type)
            return (
              <div
                key={alert.id}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border",
                  getColor(alert.type)
                )}
              >
                <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs opacity-75 mt-1">
                    {formatDistanceToNow(new Date(alert.timestamp), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                <button
                  onClick={() => acknowledgeAlert(alert.id)}
                  className="rounded p-1 hover:bg-black/10"
                  aria-label="Acquitter l'alerte"
                  title="Acquitter"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
        )}
      </CardContent>
    </Card>
  )
}

