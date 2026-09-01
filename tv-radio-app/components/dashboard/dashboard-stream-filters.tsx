"use client"

import { cn } from "@/lib/utils"
import type { StreamRow } from "@/components/StreamTable"

export type ProtocolFilter = "ALL" | StreamRow["protocol"]
export type StatusFilter = "ALL" | StreamRow["status"]

type DashboardStreamFiltersProps = {
  protocol: ProtocolFilter
  status: StatusFilter
  onProtocolChange: (value: ProtocolFilter) => void
  onStatusChange: (value: StatusFilter) => void
  counts: {
    total: number
    filtered: number
    byProtocol: Record<StreamRow["protocol"], number>
    byStatus: Record<StreamRow["status"], number>
  }
}

const PROTOCOLS: { value: ProtocolFilter; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "SRT", label: "SRT" },
  { value: "RTMP", label: "RTMP" },
  { value: "HLS", label: "HLS" },
  { value: "ICECAST", label: "Icecast" },
]

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "LIVE", label: "Live" },
  { value: "DEGRADED", label: "Dégradé" },
  { value: "REC", label: "REC" },
  { value: "OFFLINE", label: "Offline" },
]

function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-border hover:text-foreground"
      )}
      aria-pressed={active}
    >
      {label}
      {count !== undefined ? (
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {count}
        </span>
      ) : null}
    </button>
  )
}

export function DashboardStreamFilters({
  protocol,
  status,
  onProtocolChange,
  onStatusChange,
  counts,
}: DashboardStreamFiltersProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Filtres flux</p>
        <p className="text-xs text-muted-foreground">
          {counts.filtered} / {counts.total} affichés
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Protocole</p>
        <div className="flex flex-wrap gap-2">
          {PROTOCOLS.map((item) => (
            <FilterChip
              key={item.value}
              active={protocol === item.value}
              label={item.label}
              count={item.value === "ALL" ? counts.total : counts.byProtocol[item.value as StreamRow["protocol"]]}
              onClick={() => onProtocolChange(item.value)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Statut</p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((item) => (
            <FilterChip
              key={item.value}
              active={status === item.value}
              label={item.label}
              count={item.value === "ALL" ? counts.total : counts.byStatus[item.value as StreamRow["status"]]}
              onClick={() => onStatusChange(item.value)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function filterStreamRows(
  rows: StreamRow[],
  protocol: ProtocolFilter,
  status: StatusFilter
): StreamRow[] {
  return rows.filter((row) => {
    const protocolOk = protocol === "ALL" || row.protocol === protocol
    const statusOk = status === "ALL" || row.status === status
    return protocolOk && statusOk
  })
}

export function streamFilterCounts(rows: StreamRow[]) {
  const byProtocol: Record<StreamRow["protocol"], number> = {
    SRT: 0,
    RTMP: 0,
    HLS: 0,
    ICECAST: 0,
  }
  const byStatus: Record<StreamRow["status"], number> = {
    LIVE: 0,
    DEGRADED: 0,
    OFFLINE: 0,
    REC: 0,
  }
  for (const row of rows) {
    byProtocol[row.protocol] += 1
    byStatus[row.status] += 1
  }
  return { total: rows.length, byProtocol, byStatus }
}
