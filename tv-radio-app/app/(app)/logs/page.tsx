"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import type { LogEntry } from "@/types/streams"
import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/shell/page-header"
import { DataToolbar } from "@/components/shared/data-toolbar"

const LOG_SOURCES = [
  { value: "toubatv", label: "Touba TV" },
  { value: "external-tv", label: "External TV" },
  { value: "external-tv-2", label: "External TV 2" },
  { value: "external-tv-3", label: "External TV 3" },
  { value: "icecast2", label: "Icecast" },
  { value: "nginx", label: "Nginx" },
].sort((a, b) => a.label.localeCompare(b.label))

type LogPreset = {
  id: string
  label: string
  source?: string
  since?: string
  level?: "all" | "info" | "warning" | "error"
  grep?: string
}

const LOG_PRESETS: LogPreset[] = [
  { id: "errors-15m", label: "Erreurs 15 min", since: "15m", level: "error" },
  { id: "nginx-5xx", label: "Nginx 5xx", source: "nginx", grep: "5xx" },
  { id: "ffmpeg-warn", label: "FFmpeg / SRT warnings", source: "toubatv", level: "warning" },
  { id: "icecast-source", label: "Icecast source", source: "icecast2", grep: "source" },
]

export default function LogsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [levelFilter, setLevelFilter] = useState<"all" | "info" | "warning" | "error">("all")
  const [source, setSource] = useState("toubatv")
  const [since, setSince] = useState<string>("")
  const [serverGrep, setServerGrep] = useState<string>("")
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    try {
      setError(null)
      const params = new URLSearchParams({
        source,
        limit: "200",
      })
      if (since) params.set("since", since)
      if (serverGrep) params.set("grep", serverGrep)
      if (levelFilter !== "all") params.set("level", levelFilter)

      const res = await apiFetch(`/api/logs?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setLogs(data.logs || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement logs")
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [source, since, serverGrep, levelFilter])

  useEffect(() => {
    setLoading(true)
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [fetchLogs])

  const applyPreset = (preset: LogPreset) => {
    setActivePreset(preset.id)
    if (preset.source) setSource(preset.source)
    setSince(preset.since || "")
    setServerGrep(preset.grep || "")
    setLevelFilter(preset.level || "all")
  }

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch = searchQuery
        ? log.message.toLowerCase().includes(searchQuery.toLowerCase())
        : true
      return matchesSearch
    })
  }, [logs, searchQuery])

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-500/12 text-red-200 border-red-500/30"
      case "warning":
        return "bg-yellow-500/12 text-yellow-200 border-yellow-500/30"
      case "info":
        return "bg-cyan-500/12 text-foreground border-cyan-500/30"
      default:
        return "bg-slate-500/12 text-foreground/90 border-slate-500/30"
    }
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Journaux"
          description="Logs système en temps réel (rafraîchis toutes les 5 s)"
        />

        <DataToolbar className="flex-col items-stretch sm:items-stretch">
          <div className="flex flex-wrap gap-2">
            {LOG_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  activePreset === preset.id
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border/80 bg-muted/30 text-muted-foreground hover:border-border"
                )}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setActivePreset(null)
                setSince("")
                setServerGrep("")
                setLevelFilter("all")
              }}
              className="rounded-lg border border-border/80 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Réinitialiser filtres
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={source}
              onValueChange={(v) => {
                setSource(v)
                setActivePreset(null)
              }}
            >
              <SelectTrigger className="w-44 border-border/80 bg-input text-foreground">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                {LOG_SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Rechercher dans les logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm border-border/80 bg-input text-foreground placeholder:text-muted-foreground"
            />
            <Select
              value={levelFilter}
              onValueChange={(v: "all" | "info" | "warning" | "error") => {
                setLevelFilter(v)
                setActivePreset(null)
              }}
            >
              <SelectTrigger className="w-40 border-border/80 bg-input text-foreground">
                <SelectValue placeholder="Niveau" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Avertissement</SelectItem>
                <SelectItem value="error">Erreur</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true)
                fetchLogs()
              }}
              disabled={loading}
              className="border-border/80 bg-card"
            >
              {loading && logs.length > 0 ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Rafraîchir
            </Button>
          </div>
        </DataToolbar>

        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle>Journal système</CardTitle>
            <p className="text-sm text-muted-foreground">
              Source : {LOG_SOURCES.find((s) => s.value === source)?.label ?? source}
              {since ? ` · depuis ${since}` : ""}
              {serverGrep ? ` · filtre « ${serverGrep} »` : ""}
            </p>
          </CardHeader>
          <CardContent>
            {loading && logs.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-2 font-mono text-sm">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className={`p-3 rounded border ${getLevelColor(log.level)}`}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {log.level.toUpperCase()}
                        </Badge>
                        {(log.streamId || log.source) && (
                          <Badge variant="outline" className="text-xs">
                            {log.streamId || log.source}
                          </Badge>
                        )}
                      </div>
                      <p className="break-all">{log.message}</p>
                    </div>
                  ))}
                  {filteredLogs.length === 0 && (
                    <p className="py-8 text-center text-muted-foreground">Aucune entrée de log</p>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
