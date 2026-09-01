"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StreamTable, type StreamRow } from "@/components/StreamTable"
import { StreamModal } from "@/components/StreamModal"
import { PlayerModal } from "@/components/PlayerModal"
import { useSrsStats } from "@/hooks/useSrsStats"
import { useStreams } from "@/hooks/useStreams"
import {
  buildStreamRowsWithMetaFromSrs,
  ffmpegSrtPipelineLiveMapFromStreams,
  icecastLiveMapFromStreams,
} from "@/lib/dashboard-stream-rows"
import { useRecordingStatus } from "@/hooks/useRecordingStatus"
import { toast } from "sonner"
import { PageHeader } from "@/components/shell/page-header"
import { Section } from "@/components/shared/section"
import { cn } from "@/lib/utils"

const tabs = ["Tous les flux", "SRT", "RTMP", "Icecast Radio", "HLS Outputs"] as const

export default function StreamsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [refreshToken, setRefreshToken] = useState(0)
  const { streams } = useSrsStats(refreshToken)
  const { data: apiStreams = [] } = useStreams()
  const { isRecording } = useRecordingStatus()
  const icecastLiveById = useMemo(() => icecastLiveMapFromStreams(apiStreams), [apiStreams])
  const ffmpegPipelineLiveById = useMemo(
    () => ffmpegSrtPipelineLiveMapFromStreams(apiStreams),
    [apiStreams]
  )
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Tous les flux")
  const [openCreate, setOpenCreate] = useState(false)
  const [preview, setPreview] = useState<StreamRow | null>(null)
  const lastCreatedRef = useRef<string | null>(null)

  useEffect(() => {
    const created = searchParams.get("created")
    if (!created || lastCreatedRef.current === created) return
    lastCreatedRef.current = created
    toast.success(`Flux "${created}" créé`)
    router.replace("/streams")
  }, [searchParams, router])

  const handleCreated = () => {
    setRefreshToken((v) => v + 1)
    setTimeout(() => setRefreshToken((v) => v + 1), 1200)
  }

  const rows = useMemo(() => {
    const allRows = buildStreamRowsWithMetaFromSrs(
      streams,
      isRecording,
      icecastLiveById,
      ffmpegPipelineLiveById
    )
    return allRows.filter((row) => {
      if (activeTab === "Tous les flux") return true
      if (activeTab === "SRT") return row.protocol === "SRT"
      if (activeTab === "RTMP") return row.protocol === "RTMP"
      if (activeTab === "Icecast Radio") return row.protocol === "ICECAST"
      return row.hlsOutput.includes(".m3u8")
    })
  }, [streams, activeTab, isRecording, icecastLiveById, ffmpegPipelineLiveById])

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Flux en direct"
          description="Tous les flux ingest et sorties HLS, filtrés par protocole"
          actions={
            <Button onClick={() => setOpenCreate(true)} className="bg-primary text-primary-foreground">
              Créer un flux
            </Button>
          }
        />

        <div className="scrollbar-core -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <Section title="Ingest">
          <Card className="border-border/80 bg-card">
            <CardContent className="grid grid-cols-1 gap-3 pt-6 text-sm md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "RTMP Ingest", value: "rtmp://stream.broadcastsn.com:1935" },
                { label: "Apps RTMP", value: "dakar · live" },
                { label: "SRT Ingest", value: ":6000–6005" },
                { label: "API SRS", value: "127.0.0.1:1985/api/v1" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border/80 bg-muted/30 p-3">
                  <p className="text-muted-foreground">{item.label}</p>
                  <code className="font-mono text-sm text-foreground">{item.value}</code>
                </div>
              ))}
            </CardContent>
          </Card>
        </Section>

        <Section title="Tableau des flux">
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
            <StreamTable rows={rows} onPreview={setPreview} />
          </div>
        </Section>
      </div>

      <StreamModal isOpen={openCreate} onClose={() => setOpenCreate(false)} onCreated={handleCreated} />
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
    </>
  )
}
