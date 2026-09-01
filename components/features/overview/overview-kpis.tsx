"use client"

import { Activity, Cpu, HardDrive, Radio } from "lucide-react"
import { MetricCard } from "@/components/shared/metric-card"

type OverviewKpisProps = {
  liveCount: number
  srtCount: number
  rtmpCount: number
  totalBitrateMbps: number
  totalClients: number
  recCount: number
  diskUsed: number
  diskFree: number
  cpu: number
  memUsed: number
  memTotal: number
}

export function OverviewKpis({
  liveCount,
  srtCount,
  rtmpCount,
  totalBitrateMbps,
  totalClients,
  recCount,
  diskUsed,
  diskFree,
  cpu,
  memUsed,
  memTotal,
}: OverviewKpisProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Flux en direct"
        value={liveCount}
        sub={`SRT ×${srtCount} · RTMP ×${rtmpCount} · Icecast ×1`}
        icon={<Activity className="h-4 w-4" />}
        tone="live"
        href="/streams"
      />
      <MetricCard
        label="Bitrate total entrant"
        value={`${totalBitrateMbps} Mbps`}
        sub={`SRS kbps.recv_30s · ${totalClients} clients`}
        icon={<Radio className="h-4 w-4" />}
        tone="live"
        href="/monitoring"
      />
      <MetricCard
        label="Enregistrements actifs"
        value={recCount}
        sub={`${diskUsed.toFixed(0)} GB utilisés · ${diskFree.toFixed(0)} GB libres /srv`}
        icon={<HardDrive className="h-4 w-4" />}
        tone="danger"
        href="/recordings"
      />
      <MetricCard
        label="CPU Serveur"
        value={`${cpu.toFixed(1)}%`}
        sub={`RAM: ${memUsed.toFixed(1)}/${memTotal.toFixed(1)} GB`}
        icon={<Cpu className="h-4 w-4" />}
        tone="info"
        href="/monitoring"
      />
    </div>
  )
}
