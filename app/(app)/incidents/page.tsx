"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { toast } from "sonner"
import { Activity, FileText, MonitorPlay, Copy, ListChecks, Loader2, Play } from "lucide-react"
import { QuickActionsPanel } from "@/components/ops/QuickActionsPanel"
import { apiFetch } from "@/lib/api-fetch"
import { PageHeader } from "@/components/shell/page-header"

type ApiAction =
  | { type: "restart-stream"; id: string }
  | { type: "srs-reload" }

type RunbookItem = {
  title: string
  severity: "P1" | "P2"
  checks: string[]
  commands: Array<{
    label: string
    command: string
    apiAction?: ApiAction
  }>
}

const RUNBOOK_ITEMS: RunbookItem[] = [
  {
    title: "Flux HLS indisponible",
    severity: "P1",
    checks: [
      "Vérifier l'alerte active (blackbox + probe_success)",
      "Contrôler le service stream concerné (start/restart)",
      "Vérifier que la playlist .m3u8 répond bien en HTTP 200",
    ],
    commands: [
      { label: "Status Touba TV", command: "systemctl status toubatv.service" },
      {
        label: "Redémarrer Touba TV",
        command: "systemctl restart toubatv.service",
        apiAction: { type: "restart-stream", id: "toubatv" },
      },
      {
        label: "Probe HLS Touba TV",
        command: "curl -I https://stream.broadcastsn.com/toubatv/index.m3u8",
      },
    ],
  },
  {
    title: "SRS sans publisher",
    severity: "P1",
    checks: [
      "Vérifier les sessions SRS (publishers/players)",
      "Relancer le flux source si aucun publisher",
      "Faire un reload config SRS si besoin",
    ],
    commands: [
      { label: "Clients SRS", command: "curl -s http://127.0.0.1:1985/api/v1/clients | jq ." },
      {
        label: "Redémarrer Touba TV",
        command: "systemctl restart toubatv.service",
        apiAction: { type: "restart-stream", id: "toubatv" },
      },
      {
        label: "Reload config SRS",
        command: "curl -X POST http://127.0.0.1:1985/api/v1/raw?rpc=reload",
        apiAction: { type: "srs-reload" },
      },
    ],
  },
  {
    title: "CPU/RAM élevée",
    severity: "P2",
    checks: [
      "Identifier le process principal consommateur",
      "Vérifier les logs d'erreur de flux et transcodage",
      "Évaluer un redémarrage ciblé (pas global)",
    ],
    commands: [
      { label: "Top processus", command: "top -b -n1 | head -30" },
      { label: "Logs Touba TV", command: "journalctl -u toubatv.service -n 100 --no-pager" },
      { label: "Logs External TV", command: "journalctl -u external-tv.service -n 100 --no-pager" },
    ],
  },
]

async function runApiAction(action: ApiAction): Promise<void> {
  if (action.type === "restart-stream") {
    const res = await apiFetch(`/api/streams/${encodeURIComponent(action.id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restart" }),
    })
    if (!res.ok) throw new Error("restart failed")
    toast.success(`Flux ${action.id} redémarré`)
    return
  }
  if (action.type === "srs-reload") {
    const res = await apiFetch("/api/srs/reload", { method: "POST" })
    if (!res.ok) throw new Error("reload failed")
    toast.success("SRS config reload déclenché")
  }
}

export default function IncidentsPage() {
  const [runningKey, setRunningKey] = useState<string | null>(null)

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Commande copiée")
    } catch {
      toast.error("Copie impossible")
    }
  }

  const executeAction = async (key: string, action: ApiAction) => {
    setRunningKey(key)
    try {
      await runApiAction(action)
    } catch {
      toast.error("Action échouée")
    } finally {
      setRunningKey(null)
    }
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Incidents & runbook"
          description="Procédures opérateur rapides pour diagnostiquer et corriger les pannes courantes"
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2 border-border/80 bg-card">
            <CardHeader>
              <CardTitle>Accès rapide</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link href="/monitoring">
                <Button variant="outline" className="gap-2">
                  <Activity className="h-4 w-4" />
                  Monitoring
                </Button>
              </Link>
              <Link href="/logs">
                <Button variant="outline" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Journaux
                </Button>
              </Link>
              <Link href="/mgmt">
                <Button variant="outline" className="gap-2">
                  <MonitorPlay className="h-4 w-4" />
                  Console Oryx SRS
                </Button>
              </Link>
              <Link href="/plan-actions">
                <Button variant="outline" className="gap-2">
                  <ListChecks className="h-4 w-4" />
                  Plan d&apos;actions
                </Button>
              </Link>
            </CardContent>
          </Card>
          <QuickActionsPanel compact className="border-border/80 bg-card" />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {RUNBOOK_ITEMS.map((item) => (
            <Card key={item.title} className="border-border/80 bg-card">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <Badge variant={item.severity === "P1" ? "destructive" : "secondary"}>
                    {item.severity}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1 text-sm font-medium">Checklist</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {item.checks.map((check) => (
                      <li key={check}>- {check}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Commandes utiles</p>
                  {item.commands.map((entry) => {
                    const key = `${item.title}-${entry.command}`
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/80 px-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">{entry.label}</p>
                          <code className="block truncate text-xs text-foreground/90">{entry.command}</code>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {entry.apiAction ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Exécuter via API"
                              aria-label={`Exécuter ${entry.label}`}
                              disabled={runningKey !== null}
                              onClick={() => executeAction(key, entry.apiAction!)}
                            >
                              {runningKey === key ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4 text-emerald-400" />
                              )}
                            </Button>
                          ) : null}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => copyText(entry.command)}
                            title="Copier la commande"
                            aria-label="Copier la commande"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}
