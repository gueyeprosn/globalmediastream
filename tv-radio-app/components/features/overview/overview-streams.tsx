"use client"

import { StreamTable, type StreamRow } from "@/components/StreamTable"
import { QuickActionsPanel } from "@/components/ops/QuickActionsPanel"
import { Section } from "@/components/shared/section"

type OverviewStreamsProps = {
  rows: StreamRow[]
  onPreview: (row: StreamRow) => void
}

export function OverviewStreams({ rows, onPreview }: OverviewStreamsProps) {
  return (
    <Section title="Flux actifs" description="Aperçu et actions rapides opérateur">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card xl:col-span-2">
          <StreamTable rows={rows} onPreview={onPreview} />
        </div>
        <QuickActionsPanel className="border-border/80 bg-card" compact />
      </div>
    </Section>
  )
}
