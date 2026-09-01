"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { PlayerModal } from "@/components/PlayerModal"
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton"
import {
  DashboardStreamFilters,
  filterStreamRows,
  streamFilterCounts,
  type ProtocolFilter,
  type StatusFilter,
} from "@/components/dashboard/dashboard-stream-filters"
import { useSrsStats } from "@/hooks/useSrsStats"
import { useSystemStats } from "@/hooks/useSystemStats"
import { useSystemHealth } from "@/hooks/useSystemHealth"
import { useRecordingStatus } from "@/hooks/useRecordingStatus"
import { useStreams } from "@/hooks/useStreams"
import { Button } from "@/components/ui/button"
import { shouldShowOnboardingBanner } from "@/components/ops/OperatorGuide"
import {
  buildStreamRowsFromSrs,
  ffmpegSrtPipelineLiveMapFromStreams,
  ffmpegSrtSignalStateMapFromStreams,
  icecastLiveMapFromStreams,
} from "@/lib/dashboard-stream-rows"
import type { StreamRow } from "@/components/StreamTable"
import { PageHeader } from "@/components/shell/page-header"
import { OverviewKpis } from "@/components/features/overview/overview-kpis"
import { OverviewCharts } from "@/components/features/overview/overview-charts"
import { OverviewStreams } from "@/components/features/overview/overview-streams"
import { OverviewAlerts } from "@/components/features/overview/overview-alerts"

const ALERT_DISMISS_KEY = "dashboard-alert-dismissed"
const FILTER_STORAGE_KEY = "dashboard-stream-filters"

type StoredFilters = {
  protocol: ProtocolFilter
  status: StatusFilter
}

export default function DashboardPage() {
  const { streams, history, totalBitrateMbps, totalClients, error, loading: srsLoading } =
    useSrsStats()
  const { data: apiStreams = [] } = useStreams()
  const {
    cpu,
    memUsed,
    memTotal,
    diskUsed,
    diskFree,
    history: systemHistory,
    loading: systemLoading,
  } = useSystemStats()
  const { health } = useSystemHealth()
  const { activeRecordings, loading: recLoading } = useRecordingStatus()
  const [dismissed, setDismissed] = useState(false)
  const [onboardingDismissed, setOnboardingDismissed] = useState(true)
  const [healthDismissed, setHealthDismissed] = useState(false)
  const [preview, setPreview] = useState<StreamRow | null>(null)
  const [protocolFilter, setProtocolFilter] = useState<ProtocolFilter>("ALL")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(ALERT_DISMISS_KEY) === "1")
      setOnboardingDismissed(!shouldShowOnboardingBanner())
    } catch {
      setDismissed(false)
      setOnboardingDismissed(true)
    }
  }, [])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FILTER_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as StoredFilters
      if (parsed.protocol) setProtocolFilter(parsed.protocol)
      if (parsed.status) setStatusFilter(parsed.status)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({ protocol: protocolFilter, status: statusFilter })
      )
    } catch {
      /* ignore */
    }
  }, [protocolFilter, statusFilter])

  const dismissAlert = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(ALERT_DISMISS_KEY, "1")
    } catch {
      /* ignore */
    }
  }

  const icecastLiveById = useMemo(() => icecastLiveMapFromStreams(apiStreams), [apiStreams])
  const ffmpegPipelineLiveById = useMemo(
    () => ffmpegSrtPipelineLiveMapFromStreams(apiStreams),
    [apiStreams]
  )
  const ffmpegSignalById = useMemo(
    () => ffmpegSrtSignalStateMapFromStreams(apiStreams),
    [apiStreams]
  )

  const rows: StreamRow[] = useMemo(
    () =>
      buildStreamRowsFromSrs(
        streams,
        (streamId) => Boolean(activeRecordings[streamId]),
        icecastLiveById,
        ffmpegPipelineLiveById,
        ffmpegSignalById
      ),
    [streams, activeRecordings, icecastLiveById, ffmpegPipelineLiveById, ffmpegSignalById]
  )

  const filterCounts = useMemo(() => streamFilterCounts(rows), [rows])
  const filteredRows = useMemo(
    () => filterStreamRows(rows, protocolFilter, statusFilter),
    [rows, protocolFilter, statusFilter]
  )

  const liveCount = useMemo(
    () => rows.filter((r) => r.status === "LIVE" || r.status === "REC").length,
    [rows]
  )
  const srtCount = streams.filter((s) => s.app !== "dakar" && s.app !== "live").length
  const rtmpCount = streams.filter((s) => s.app === "dakar" || s.app === "live").length
  const recCount = Object.keys(activeRecordings).length
  const ext2 = streams.find((s) => s.stream === "external-tv-2")
  const ext3 = streams.find((s) => s.stream === "external-tv-3")
  const ext2Live =
    Boolean(ffmpegPipelineLiveById["external-tv-2"]) ||
    Boolean(ext2 && ((ext2.bw_in_kbps || 0) > 0 || ext2.publishActive))
  const ext3Live =
    Boolean(ffmpegPipelineLiveById["external-tv-3"]) ||
    Boolean(ext3 && ((ext3.bw_in_kbps || 0) > 0 || ext3.publishActive))
  const missingSrt = [
    !ext2Live ? "External TV 2 (:6003)" : null,
    !ext3Live ? "External TV 3 (:6005)" : null,
  ].filter(Boolean) as string[]

  const initialLoading = srsLoading && systemLoading && recLoading && rows.length === 0
  const hasAlert = !dismissed && (Boolean(error) || missingSrt.length > 0)

  if (initialLoading) return <DashboardSkeleton />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Vue temps réel des flux, enregistrements et ressources serveur"
        actions={
          <>
            <Button asChild size="sm" variant="outline" className="border-border bg-card">
              <Link href="/watch" target="_blank" rel="noopener noreferrer">
                Voir le direct
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="border-border bg-card">
              <Link href="/endpoints">Liens HLS / RTMP</Link>
            </Button>
          </>
        }
      />

      <OverviewAlerts
        hasAlert={hasAlert}
        error={error}
        missingSrt={missingSrt}
        onDismissAlert={dismissAlert}
        onboardingDismissed={onboardingDismissed}
        onDismissOnboarding={() => setOnboardingDismissed(true)}
        healthCritical={health?.status === "critical"}
        healthScore={health?.score}
        healthDismissed={healthDismissed}
        onDismissHealth={() => setHealthDismissed(true)}
      />

      <OverviewKpis
        liveCount={liveCount}
        srtCount={srtCount}
        rtmpCount={rtmpCount}
        totalBitrateMbps={totalBitrateMbps}
        totalClients={totalClients}
        recCount={recCount}
        diskUsed={diskUsed}
        diskFree={diskFree}
        cpu={cpu}
        memUsed={memUsed}
        memTotal={memTotal}
      />

      <DashboardStreamFilters
        protocol={protocolFilter}
        status={statusFilter}
        onProtocolChange={setProtocolFilter}
        onStatusChange={setStatusFilter}
        counts={{
          ...filterCounts,
          filtered: filteredRows.length,
        }}
      />

      <OverviewStreams rows={filteredRows} onPreview={setPreview} />

      <OverviewCharts
        bitrate={history.bitrate}
        clients={history.clients}
        cpu={systemHistory.cpu}
        disk={systemHistory.disk}
      />

      {preview ? (
        <PlayerModal
          isOpen={Boolean(preview)}
          onClose={() => setPreview(null)}
          streamName={preview.name}
          ingestUrl=""
          hlsUrl={preview.hlsOutput}
          protocol={preview.protocol}
          bitrate={`${(preview.bitrateKbps / 1000).toFixed(2)} Mbps`}
          resolution={preview.resolution}
          fps={preview.fps}
        />
      ) : null}
    </div>
  )
}
