"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import {
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Siren,
  Activity,
  Loader2,
  RefreshCcw,
  ArrowUp,
  ArrowDown,
  Trash2,
} from "lucide-react"
import { PageHeader } from "@/components/shell/page-header"
import { MetricCard } from "@/components/shared/metric-card"

type Priority = "P1" | "P2" | "P3"
type Status = "a_faire" | "en_cours" | "termine"

type ActionItem = {
  id: string
  docSection: string
  page: string
  api: string
  priority: Priority
  status: Status
  scope: string
}

function statusLabel(status: Status): string {
  if (status === "termine") return "Termine"
  if (status === "en_cours") return "En cours"
  return "A faire"
}

export default function PlanActionsPage() {
  const [items, setItems] = useState<ActionItem[]>([])
  const [scopeDrafts, setScopeDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<Priority | "toutes">("toutes")
  const [statusFilter, setStatusFilter] = useState<Status | "tous">("tous")
  const [newItem, setNewItem] = useState<{
    docSection: string
    page: string
    api: string
    priority: Priority
    status: Status
    scope: string
  }>({
    docSection: "",
    page: "/",
    api: "N/A",
    priority: "P2",
    status: "a_faire",
    scope: "",
  })

  const loadItems = async () => {
    setLoading(true)
    try {
      const response = await apiFetch("/api/plan-actions", { cache: "no-store" })
      const json = await response.json()
      if (!response.ok) {
        toast.error(json?.error || "Impossible de charger le plan d'actions")
        return
      }
      const loadedItems = Array.isArray(json?.items) ? json.items : []
      setItems(loadedItems)
      setScopeDrafts(
        loadedItems.reduce(
          (acc: Record<string, string>, item: ActionItem) => ({ ...acc, [item.id]: item.scope }),
          {}
        )
      )
    } catch {
      toast.error("Erreur reseau lors du chargement")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadItems()
  }, [])

  const updateItem = async (
    id: string,
    patch: Partial<Pick<ActionItem, "priority" | "status" | "scope">>
  ) => {
    const previous = items
    const next = items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    setItems(next)
    setSavingId(id)

    try {
      const response = await apiFetch("/api/plan-actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      })
      const json = await response.json()
      if (!response.ok) {
        setItems(previous)
        toast.error(json?.error || "Mise a jour impossible")
        return
      }
      toast.success("Mise a jour enregistree")
    } catch {
      setItems(previous)
      toast.error("Erreur reseau pendant la mise a jour")
    } finally {
      setSavingId(null)
    }
  }

  const createItem = async () => {
    const payload = {
      docSection: newItem.docSection.trim(),
      page: newItem.page.trim(),
      api: newItem.api.trim(),
      priority: newItem.priority,
      status: newItem.status,
      scope: newItem.scope.trim(),
    }
    if (!payload.docSection || !payload.page || !payload.api || !payload.scope) {
      toast.error("Merci de remplir tous les champs de la nouvelle action")
      return
    }

    setCreating(true)
    try {
      const response = await apiFetch("/api/plan-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await response.json()
      if (!response.ok) {
        toast.error(json?.error || "Creation impossible")
        return
      }
      setItems(Array.isArray(json?.items) ? json.items : [json.item, ...items])
      setScopeDrafts((prev) => ({ ...prev, [json.item.id]: json.item.scope }))
      setNewItem({
        docSection: "",
        page: "/",
        api: "N/A",
        priority: "P2",
        status: "a_faire",
        scope: "",
      })
      toast.success("Action ajoutee")
    } catch {
      toast.error("Erreur reseau lors de la creation")
    } finally {
      setCreating(false)
    }
  }

  const moveItem = async (id: string, move: "up" | "down") => {
    const index = items.findIndex((item) => item.id === id)
    if (index < 0) return
    const targetIndex = move === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= items.length) return

    const next = [...items]
    const current = next[index]
    next[index] = next[targetIndex]
    next[targetIndex] = current
    setItems(next)
    setSavingId(id)
    try {
      const response = await apiFetch("/api/plan-actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, move }),
      })
      const json = await response.json()
      if (!response.ok) {
        toast.error(json?.error || "Reordonnancement impossible")
        setItems(items)
        return
      }
      if (Array.isArray(json?.items)) {
        setItems(json.items)
      }
      toast.success("Ordre mis a jour")
    } catch {
      setItems(items)
      toast.error("Erreur reseau pendant le reordonnancement")
    } finally {
      setSavingId(null)
    }
  }

  const deleteItem = async (id: string) => {
    const target = items.find((item) => item.id === id)
    if (!target) return
    const confirmed = window.confirm(`Supprimer l'action ${id} ?`)
    if (!confirmed) return

    const previous = items
    const next = items.filter((item) => item.id !== id)
    setItems(next)
    setSavingId(id)
    try {
      const response = await apiFetch("/api/plan-actions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const json = await response.json()
      if (!response.ok) {
        setItems(previous)
        toast.error(json?.error || "Suppression impossible")
        return
      }
      if (Array.isArray(json?.items)) {
        setItems(json.items)
      }
      setScopeDrafts((prev) => {
        const copy = { ...prev }
        delete copy[id]
        return copy
      })
      toast.success("Action supprimee")
    } catch {
      setItems(previous)
      toast.error("Erreur reseau pendant la suppression")
    } finally {
      setSavingId(null)
    }
  }

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const byPriority = priorityFilter === "toutes" ? true : item.priority === priorityFilter
      const byStatus = statusFilter === "tous" ? true : item.status === statusFilter
      return byPriority && byStatus
    })
  }, [items, priorityFilter, statusFilter])

  const doneCount = items.filter((i) => i.status === "termine").length
  const inProgressCount = items.filter((i) => i.status === "en_cours").length
  const todoCount = items.filter((i) => i.status === "a_faire").length

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Plan d'actions"
          description="Matrice Doc section · Page UI · API · Priorité pour exécuter les améliorations sprint par sprint"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Terminés" value={doneCount} tone="live" icon={<CheckCircle2 className="h-4 w-4" />} />
          <MetricCard label="En cours" value={inProgressCount} tone="warn" icon={<Clock3 className="h-4 w-4" />} />
          <MetricCard label="À faire" value={todoCount} tone="danger" icon={<AlertTriangle className="h-4 w-4" />} />
        </div>

        <Card className="border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Progression globale</CardTitle>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => void loadItems()}>
              <RefreshCcw className="h-4 w-4" />
              Rafraîchir
            </Button>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Terminé: {doneCount}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Clock3 className="h-4 w-4" />
              En cours: {inProgressCount}
            </Badge>
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-4 w-4" />À faire: {todoCount}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Filtres</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={priorityFilter === "toutes" ? "default" : "outline"}
              onClick={() => setPriorityFilter("toutes")}
            >
              Toutes priorités
            </Button>
            {(["P1", "P2", "P3"] as Priority[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={priorityFilter === p ? "default" : "outline"}
                onClick={() => setPriorityFilter(p)}
              >
                {p}
              </Button>
            ))}
            <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
            <Button
              size="sm"
              variant={statusFilter === "tous" ? "default" : "outline"}
              onClick={() => setStatusFilter("tous")}
            >
              Tous statuts
            </Button>
            {(["a_faire", "en_cours", "termine"] as Status[]).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
              >
                {statusLabel(s)}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ajouter une action</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 lg:grid-cols-6">
            <input
              className="rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900"
              placeholder="Section doc"
              value={newItem.docSection}
              onChange={(e) => setNewItem((prev) => ({ ...prev, docSection: e.target.value }))}
            />
            <input
              className="rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900"
              placeholder="Page UI (ex: /monitoring)"
              value={newItem.page}
              onChange={(e) => setNewItem((prev) => ({ ...prev, page: e.target.value }))}
            />
            <input
              className="rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900"
              placeholder="API concernee"
              value={newItem.api}
              onChange={(e) => setNewItem((prev) => ({ ...prev, api: e.target.value }))}
            />
            <select
              className="rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900"
              value={newItem.priority}
              onChange={(e) =>
                setNewItem((prev) => ({ ...prev, priority: e.target.value as Priority }))
              }
            >
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
            </select>
            <select
              className="rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900"
              value={newItem.status}
              onChange={(e) => setNewItem((prev) => ({ ...prev, status: e.target.value as Status }))}
            >
              <option value="a_faire">A faire</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Termine</option>
            </select>
            <Button onClick={() => void createItem()} disabled={creating}>
              {creating ? "Ajout..." : "Ajouter"}
            </Button>
            <div className="lg:col-span-6">
              <Textarea
                placeholder="Scope de l'action"
                value={newItem.scope}
                onChange={(e) => setNewItem((prev) => ({ ...prev, scope: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Matrice d&apos;exécution</CardTitle>
            <div className="flex items-center gap-2">
              <Link href="/incidents">
                <Button size="sm" variant="outline" className="gap-2">
                  <Siren className="h-4 w-4" />
                  Runbook
                </Button>
              </Link>
              <Link href="/monitoring">
                <Button size="sm" variant="outline" className="gap-2">
                  <Activity className="h-4 w-4" />
                  Monitoring
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Chargement du plan d&apos;actions...
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="px-2 py-2 text-left">ID</th>
                    <th className="px-2 py-2 text-left">Section doc</th>
                    <th className="px-2 py-2 text-left">Page UI</th>
                    <th className="px-2 py-2 text-left">API concernée</th>
                    <th className="px-2 py-2 text-left">Priorité</th>
                    <th className="px-2 py-2 text-left">Statut</th>
                    <th className="px-2 py-2 text-left">Scope</th>
                    <th className="px-2 py-2 text-left">Edition scope</th>
                    <th className="px-2 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const absoluteIndex = items.findIndex((entry) => entry.id === item.id)
                    return (
                    <tr key={item.id} className="border-b border-gray-100 dark:border-gray-900">
                      <td className="px-2 py-2 font-mono">{item.id}</td>
                      <td className="px-2 py-2">{item.docSection}</td>
                      <td className="px-2 py-2 font-mono">{item.page}</td>
                      <td className="px-2 py-2 font-mono">{item.api}</td>
                      <td className="px-2 py-2">
                        <select
                          className="w-20 rounded border border-gray-200 bg-white px-2 py-1 dark:border-gray-800 dark:bg-gray-900"
                          value={item.priority}
                          onChange={(e) =>
                            void updateItem(item.id, { priority: e.target.value as Priority })
                          }
                          disabled={savingId === item.id}
                        >
                          <option value="P1">P1</option>
                          <option value="P2">P2</option>
                          <option value="P3">P3</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className="w-28 rounded border border-gray-200 bg-white px-2 py-1 dark:border-gray-800 dark:bg-gray-900"
                          value={item.status}
                          onChange={(e) =>
                            void updateItem(item.id, { status: e.target.value as Status })
                          }
                          disabled={savingId === item.id}
                        >
                          <option value="a_faire">A faire</option>
                          <option value="en_cours">En cours</option>
                          <option value="termine">Termine</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">{item.scope}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <Textarea
                            className="min-h-[64px]"
                            value={scopeDrafts[item.id] ?? item.scope}
                            onChange={(e) =>
                              setScopeDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            disabled={savingId === item.id}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void updateItem(item.id, {
                                scope: (scopeDrafts[item.id] ?? item.scope).trim() || item.scope,
                              })
                            }
                            disabled={savingId === item.id}
                          >
                            Enregistrer
                          </Button>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Monter"
                            aria-label="Monter"
                            disabled={savingId === item.id || absoluteIndex <= 0}
                            onClick={() => void moveItem(item.id, "up")}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Descendre"
                            aria-label="Descendre"
                            disabled={savingId === item.id || absoluteIndex >= items.length - 1}
                            onClick={() => void moveItem(item.id, "down")}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600 hover:text-red-600"
                            title="Supprimer"
                            aria-label="Supprimer"
                            disabled={savingId === item.id}
                            onClick={() => void deleteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
