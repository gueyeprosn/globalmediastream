"use client"

import { useGlobalMetrics } from "@/hooks/useMetrics"
import { Activity, Wifi, Cpu, AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export function DashboardOverview() {
  const { data: metrics, isLoading } = useGlobalMetrics()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="h-32 animate-pulse bg-gray-200 dark:bg-gray-800" />
        ))}
      </div>
    )
  }

  const cards = [
    {
      title: "Flux en direct",
      value: metrics?.totalActiveStreams || 0,
      icon: Activity,
      color: "text-primary",
      bgColor: "bg-[#00e676]/10",
      lineColor: "bg-[#00e676]",
    },
    {
      title: "Bande passante",
      value: `${(metrics?.totalBandwidth || 0).toFixed(0)} kbps`,
      icon: Wifi,
      color: "text-[#00d4ff]",
      bgColor: "bg-[#00d4ff]/10",
      lineColor: "bg-[#00d4ff]",
    },
    {
      title: "CPU / Encodage",
      value: `${(metrics?.cpuUsage || 0).toFixed(1)}%`,
      icon: Cpu,
      color: "text-[#a855f7]",
      bgColor: "bg-[#a855f7]/10",
      lineColor: "bg-[#a855f7]",
    },
    {
      title: "Paquets perdus",
      value: `${(metrics?.packetLoss || 0).toFixed(2)}%`,
      icon: AlertTriangle,
      color: "text-[#f5c400]",
      bgColor: "bg-[#f5c400]/10",
      lineColor: "bg-[#f5c400]",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.title} className="relative overflow-hidden border-border/80 bg-card">
            <div className={`absolute left-0 top-0 h-0.5 w-full ${card.lineColor}`} />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                    {card.title}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {card.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${card.bgColor}`}>
                  <Icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

