"use client"

import { MetricAreaChart } from "@/components/dashboard/metric-area-chart"
import { Section } from "@/components/shared/section"

type OverviewChartsProps = {
  bitrate: number[]
  clients: number[]
  cpu: number[]
  disk: number[]
}

export function OverviewCharts({ bitrate, clients, cpu, disk }: OverviewChartsProps) {
  return (
    <Section title="Métriques" description="Tendances temps réel bitrate, clients et ressources">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <MetricAreaChart data={bitrate} label="Bitrate entrant" unit="Mbps" color="var(--primary)" />
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <MetricAreaChart data={clients} label="Clients connectés HLS" color="var(--chart-2)" />
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <MetricAreaChart data={cpu} label="CPU serveur" unit="%" color="var(--chart-4)" />
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <MetricAreaChart
            data={disk}
            label="Disque /srv/recordings"
            unit="%"
            color="var(--chart-3)"
          />
        </div>
      </div>
    </Section>
  )
}
