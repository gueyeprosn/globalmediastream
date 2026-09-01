"use client"

import { Copy, Eye, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bitratebar } from "@/components/Bitratebar"
import { toast } from "sonner"

export type StreamRow = {
  name: string
  protocol: "SRT" | "RTMP" | "HLS" | "ICECAST"
  status: "LIVE" | "OFFLINE" | "REC"
  bitrateKbps: number
  resolution: string
  fps: string
  clients: number
  duration: string
  hlsOutput: string
  maxBitrateKbps: number
}

type StreamTableProps = {
  rows: StreamRow[]
  onPreview?: (row: StreamRow) => void
  onToggleRecord?: (row: StreamRow) => void
}

function statusBadge(status: StreamRow["status"]) {
  if (status === "LIVE") return <Badge className="bg-emerald-500/15 text-emerald-300">● LIVE</Badge>
  if (status === "REC") return <Badge className="bg-red-500/15 text-red-300">● REC</Badge>
  return <Badge variant="secondary">OFFLINE</Badge>
}

function StreamRowActions({
  row,
  onPreview,
  onToggleRecord,
  layout = "row",
}: {
  row: StreamRow
  onPreview?: (row: StreamRow) => void
  onToggleRecord?: (row: StreamRow) => void
  layout?: "row" | "grid"
}) {
  const isOffline = row.status === "OFFLINE"
  const canPreview = Boolean(onPreview) && !isOffline
  const canRecord = Boolean(onToggleRecord) && !isOffline
  const showRecord = Boolean(onToggleRecord)
  const gridCols = showRecord ? "grid-cols-3" : "grid-cols-2"

  return (
    <div className={layout === "grid" ? `grid ${gridCols} gap-2` : "flex items-center gap-1"}>
      {showRecord ? (
        <Button
          size="icon"
          variant="outline"
          className="h-11 w-11 min-h-11 min-w-11"
          disabled={!canRecord}
          aria-label={canRecord ? `Enregistrer ${row.name}` : `Enregistrement indisponible pour ${row.name}`}
          title={canRecord ? "Démarrer/arrêter enregistrement" : "Action indisponible"}
          onClick={() => onToggleRecord?.(row)}
        >
          <Radio className="h-4 w-4" />
        </Button>
      ) : null}
      <Button
        size="icon"
        variant="outline"
        className="h-11 w-11 min-h-11 min-w-11"
        disabled={!canPreview}
        aria-label={canPreview ? `Prévisualiser ${row.name}` : `Prévisualisation indisponible pour ${row.name}`}
        title={canPreview ? "Prévisualiser" : "Prévisualisation indisponible"}
        onClick={() => onPreview?.(row)}
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="h-11 w-11 min-h-11 min-w-11"
        aria-label={`Copier l'URL HLS de ${row.name}`}
        title="Copier URL HLS"
        onClick={async () => {
          await navigator.clipboard.writeText(row.hlsOutput)
          toast.success("Copié dans le presse-papiers")
        }}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  )
}

function StreamMobileCard({
  row,
  onPreview,
  onToggleRecord,
}: {
  row: StreamRow
  onPreview?: (row: StreamRow) => void
  onToggleRecord?: (row: StreamRow) => void
}) {
  const isOffline = row.status === "OFFLINE"

  return (
    <article
      className={`rounded-lg border border-border/80 bg-card p-4 ${isOffline ? "opacity-60" : ""}`}
      aria-label={`Flux ${row.name}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-foreground">{row.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{row.protocol}</Badge>
            {statusBadge(row.status)}
          </div>
        </div>
        <StreamRowActions row={row} onPreview={onPreview} onToggleRecord={onToggleRecord} layout="row" />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Bitrate</dt>
          <dd className="mt-0.5">
            <Bitratebar value={row.bitrateKbps} maxBitrate={row.maxBitrateKbps} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Clients</dt>
          <dd className="mt-0.5 font-mono text-foreground/90">{row.clients}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Résolution</dt>
          <dd className="mt-0.5 text-foreground/90">{row.resolution}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">FPS · Durée</dt>
          <dd className="mt-0.5 font-mono text-foreground/90">
            {row.fps} · {row.duration}
          </dd>
        </div>
      </dl>

      <p className="mt-3 truncate font-mono text-[11px] text-foreground/90" title={row.hlsOutput}>
        {row.hlsOutput}
      </p>
    </article>
  )
}

export function StreamTable({ rows, onPreview, onToggleRecord }: StreamTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Aucun flux détecté pour le moment.</p>
        <p className="mt-1 text-xs text-muted-foreground">Vérifiez vos encodeurs SRT/RTMP ou la connexion SRS.</p>
      </div>
    )
  }

  return (
    <>
      {/* Mobile / tablette : cartes */}
      <div className="space-y-3 p-3 md:hidden">
        {rows.map((row) => (
          <StreamMobileCard
            key={row.name}
            row={row}
            onPreview={onPreview}
            onToggleRecord={onToggleRecord}
          />
        ))}
      </div>

      {/* Desktop : table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border/80">
              {["Nom / Ingest", "Protocole", "Statut", "Bitrate", "Résolution", "FPS", "Clients", "Durée", "HLS Output", "Actions"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isOffline = row.status === "OFFLINE"
              return (
                <tr key={row.name} className={`border-b border-border/80/60 ${isOffline ? "opacity-40" : ""}`}>
                  <td className="px-3 py-2 font-medium text-foreground">{row.name}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{row.protocol}</Badge></td>
                  <td className="px-3 py-2">{statusBadge(row.status)}</td>
                  <td className="px-3 py-2"><Bitratebar value={row.bitrateKbps} maxBitrate={row.maxBitrateKbps} /></td>
                  <td className="px-3 py-2 text-foreground/90">{row.resolution}</td>
                  <td className="px-3 py-2 text-foreground/90">{row.fps}</td>
                  <td className="px-3 py-2 text-foreground/90">{row.clients}</td>
                  <td className="px-3 py-2 font-mono text-xs text-foreground/90">{row.duration}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs text-foreground" title={row.hlsOutput}>
                    {row.hlsOutput}
                  </td>
                  <td className="px-3 py-2">
                    <StreamRowActions row={row} onPreview={onPreview} onToggleRecord={onToggleRecord} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
