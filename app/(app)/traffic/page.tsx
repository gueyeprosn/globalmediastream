"use client"

import { PageHeader } from "@/components/shell/page-header"
import { TrafficDashboard } from "@/components/traffic/traffic-dashboard"

export default function TrafficPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Trafic & KPI"
        description="Connexions SRS, IP, heure de démarrage, débits, pipelines systemd et viewers HLS"
      />
      <TrafficDashboard />
    </div>
  )
}
