"use client"

import { useState, type ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, Trash2, RotateCcw, Server } from "lucide-react"
import { toast } from "sonner"
import { ConfirmAction } from "@/components/shared/confirm-action"
import { apiFetch } from "@/lib/api-fetch"
import { useReloadSrsConfig } from "@/hooks/useSrs"

type QuickAction = {
  id: string
  label: string
  description: string
  icon: ReactNode
  variant?: "default" | "outline" | "destructive"
  run: () => Promise<void>
}

type QuickActionsPanelProps = {
  className?: string
  compact?: boolean
}

export function QuickActionsPanel({ className, compact }: QuickActionsPanelProps) {
  const [runningId, setRunningId] = useState<string | null>(null)
  const reloadMutation = useReloadSrsConfig()

  const runAction = async (action: QuickAction) => {
    setRunningId(action.id)
    try {
      await action.run()
    } finally {
      setRunningId(null)
    }
  }

  const actions: QuickAction[] = [
    {
      id: "srs-reload",
      label: "Reload SRS",
      description: "Recharger la configuration SRS (:1985)",
      icon: <RefreshCw className="h-4 w-4" />,
      run: async () => {
        await new Promise<void>((resolve, reject) => {
          reloadMutation.mutate(undefined, {
            onSuccess: () => {
              toast.success("SRS config reload déclenché")
              resolve()
            },
            onError: () => {
              toast.error("Échec reload SRS")
              reject(new Error("reload failed"))
            },
          })
        })
      },
    },
    {
      id: "restart-toubatv",
      label: "Redémarrer Touba TV",
      description: "systemctl restart toubatv.service",
      icon: <RotateCcw className="h-4 w-4" />,
      run: async () => {
        const res = await apiFetch("/api/streams/toubatv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "restart" }),
        })
        if (!res.ok) throw new Error("restart failed")
        toast.success("Touba TV redémarré")
      },
    },
    {
      id: "restart-external",
      label: "Redémarrer External TV",
      description: "systemctl restart external-tv.service",
      icon: <RotateCcw className="h-4 w-4" />,
      run: async () => {
        const res = await apiFetch("/api/streams/external-tv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "restart" }),
        })
        if (!res.ok) throw new Error("restart failed")
        toast.success("External TV redémarré")
      },
    },
    {
      id: "cleanup-disk",
      label: "Nettoyage disque",
      description: "Script cleanup VPS (/srv/recordings)",
      icon: <Trash2 className="h-4 w-4" />,
      variant: "outline",
      run: async () => {
        const res = await apiFetch("/api/system/cleanup", { method: "POST" })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.success) {
          toast.error(data.error || "Échec nettoyage")
          throw new Error("cleanup failed")
        }
        toast.success("Nettoyage terminé")
      },
    },
  ]

  return (
    <Card className={className}>
      <CardHeader className={compact ? "py-3" : undefined}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Server className="h-4 w-4" />
          Actions rapides
        </CardTitle>
      </CardHeader>
      <CardContent className={compact ? "space-y-2 pt-0" : "space-y-2"}>
        {actions.map((action) => (
          <div
            key={action.id}
            className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </div>
            {action.id === "cleanup-disk" ? (
              <ConfirmAction
                title="Nettoyage système"
                description={
                  <span className="block whitespace-pre-line text-left">
                    {`Cette action peut supprimer des fichiers temporaires et des données
de nettoyage prévues par le système.
Voulez-vous vraiment continuer ?`}
                  </span>
                }
                confirmLabel="Nettoyer"
                cancelLabel="Annuler"
                destructive
                onConfirm={() => void runAction(action)}
                trigger={
                  <Button
                    type="button"
                    size="sm"
                    variant={action.variant || "default"}
                    disabled={runningId !== null}
                    className="shrink-0 gap-1.5"
                  >
                    {runningId === action.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      action.icon
                    )}
                    Exécuter
                  </Button>
                }
              />
            ) : (
              <Button
                type="button"
                size="sm"
                variant={action.variant || "default"}
                disabled={runningId !== null}
                onClick={() => runAction(action)}
                className="shrink-0 gap-1.5"
              >
                {runningId === action.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  action.icon
                )}
                Exécuter
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
