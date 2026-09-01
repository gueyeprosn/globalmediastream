"use client"

import { useCallback, useEffect, useState } from "react"
import { PageHeader } from "@/components/shell/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RefreshCcw, Loader2 } from "lucide-react"
import { apiFetch } from "@/lib/api-fetch"

type AuditRow = {
  id: number
  timestamp: string
  request_id: string | null
  user_sub: string | null
  user_role: string | null
  action: string
  target: string | null
  result: string
  duration_ms: number | null
  ip: string | null
}

const PAGE_SIZE = 50

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [actionFilter, setActionFilter] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (currentOffset: number, action: string) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(currentOffset),
      })
      if (action.trim()) qs.set("action", action.trim())
      const res = await apiFetch(`/api/audit?${qs.toString()}`)
      if (!res.ok) throw new Error("Échec du chargement")
      const data = (await res.json()) as { rows: AuditRow[]; total: number }
      setRows(data.rows)
      setTotal(data.total)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(offset, actionFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal d'audit"
        description="Historique des actions opérateur sur l'infrastructure (qui, quoi, quand, résultat)."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(offset, actionFilter)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Actualiser
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Filtrer par action (ex: srs:kick, stream:restart)"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setOffset(0)
                  void load(0, actionFilter)
                }
              }}
              className="max-w-sm"
            />
            <Button
              size="sm"
              onClick={() => {
                setOffset(0)
                void load(0, actionFilter)
              }}
            >
              Filtrer
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horodatage</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Cible</TableHead>
                  <TableHead>Résultat</TableHead>
                  <TableHead className="text-right">Durée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {new Date(row.timestamp).toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      {row.user_sub || "—"}
                      {row.user_role ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({row.user_role})
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.action}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {row.target || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.result === "success" ? "default" : "destructive"}>
                        {row.result}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {row.duration_ms != null ? `${row.duration_ms} ms` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Aucune entrée.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {total} entrée{total > 1 ? "s" : ""} au total
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + PAGE_SIZE >= total || loading}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Suivant
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
