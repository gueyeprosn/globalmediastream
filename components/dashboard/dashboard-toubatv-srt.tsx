"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useStreams } from "@/hooks/useStreams"
import { ffmpegSrtPipelineLiveMapFromStreams } from "@/lib/dashboard-stream-rows"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Tv, Radio, Loader2, Copy, Check } from "lucide-react"
import { toast } from "sonner"

type PipelineDef = {
  streamId: string
  title: string
  port: number
  description: string
  hlsUrl: string
  watchHref: string
  watchLabel: string
}

const FEATURED_PIPELINES: PipelineDef[] = [
  {
    streamId: "toubatv",
    title: "Touba TV",
    port: 6000,
    description: "Entrée SRT (port 6000) → FFmpeg → HLS. Aperçu du flux et liens de diffusion.",
    hlsUrl: "https://stream.broadcastsn.com/toubatv/index.m3u8",
    watchHref: "/watch",
    watchLabel: "Voir le direct Touba TV",
  },
  {
    streamId: "external-tv",
    title: "External TV",
    port: 6001,
    description: "Entrée SRT (port 6001) → FFmpeg → HLS. Aperçu du flux et liens de diffusion.",
    hlsUrl: "https://stream.broadcastsn.com/external-tv/index.m3u8",
    watchHref: "/watch?c=external-tv",
    watchLabel: "Voir le direct External TV",
  },
  {
    streamId: "external-tv-2",
    title: "External TV 2",
    port: 6003,
    description: "Entrée SRT (port 6003) → FFmpeg → HLS. Aperçu du flux et liens de diffusion.",
    hlsUrl: "https://stream.broadcastsn.com/external-tv-2/index.m3u8",
    watchHref: "/watch?c=external-tv-2",
    watchLabel: "Voir le direct External TV 2",
  },
  {
    streamId: "external-tv-3",
    title: "External TV 3",
    port: 6005,
    description: "Entrée SRT (port 6005) → FFmpeg → HLS. Aperçu du flux et liens de diffusion.",
    hlsUrl: "https://stream.broadcastsn.com/external-tv-3/index.m3u8",
    watchHref: "/watch?c=external-tv-3",
    watchLabel: "Voir le direct External TV 3",
  },
]

function FeaturedSrtPipelineCard({
  def,
  isLive,
  isLoading,
  uptime,
  cpu,
  memory,
}: {
  def: PipelineDef
  isLive: boolean
  isLoading: boolean
  uptime?: string
  cpu?: number
  memory?: string
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const srtUrl = `srt://stream.broadcastsn.com:${def.port}`

  const copyKeySrt = `srt-${def.streamId}`
  const copyKeyHls = `hls-${def.streamId}`

  const copyToClipboard = (text: string, stateKey: string, toastLabel: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(stateKey)
        toast.success(`${toastLabel} copié`)
        setTimeout(() => setCopied(null), 2000)
      },
      () => toast.error("Copie impossible")
    )
  }

  if (isLoading) {
    return (
      <Card className="border-border/80 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            {def.title} — SRT port {def.port}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/80 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5" />
          {def.title} — SRT port {def.port}
        </CardTitle>
        <CardDescription>{def.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={isLive ? "default" : "secondary"}
            className={
              isLive
                ? "border border-emerald-500/30 bg-emerald-500/12 text-emerald-300"
                : "border border-slate-600/40 bg-slate-700/30 text-muted-foreground"
            }
          >
            {isLive ? "LIVE" : "OFFLINE"}
          </Badge>
          {uptime && (
            <Badge variant="outline">Uptime {uptime}</Badge>
          )}
          {cpu != null && (
            <Badge variant="outline">CPU {cpu}%</Badge>
          )}
          {memory && (
            <Badge variant="outline">RAM {memory}</Badge>
          )}
        </div>

        <div className="grid gap-3 text-sm">
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
            <p className="text-muted-foreground mb-1 font-medium">Entrée SRT (encodeur)</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded border border-border/80 bg-[#0a121e] px-2 py-1 text-xs">
                {srtUrl}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => copyToClipboard(srtUrl, copyKeySrt, "URL SRT")}
              >
                {copied === copyKeySrt ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Port {def.port} — mode listener
            </p>
          </div>

          <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
            <p className="text-muted-foreground mb-1 font-medium">Sortie HLS (lecteurs)</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded border border-border/80 bg-[#0a121e] px-2 py-1 text-xs">
                {def.hlsUrl}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => copyToClipboard(def.hlsUrl, copyKeyHls, "URL HLS")}
              >
                {copied === copyKeyHls ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <Link href={def.watchHref} target="_blank" rel="noopener noreferrer" className="block">
          <Button
            variant="default"
            className="w-full bg-[var(--brand-gold)] text-[#1f1500] hover:brightness-110 sm:w-auto"
            size="sm"
          >
            <Tv className="mr-2 h-4 w-4" />
            {def.watchLabel}
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

/** Cartes mises en avant SRT → FFmpeg → HLS (Touba TV, External TV 1–3), statut aligné sur `/api/streams`. */
export function DashboardFeaturedSrtPipelines() {
  const { data: streams = [], isLoading } = useStreams()
  const pipelineLiveById = useMemo(() => ffmpegSrtPipelineLiveMapFromStreams(streams), [streams])

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {FEATURED_PIPELINES.map((def) => {
        const row = streams.find((s: { id?: string }) => s.id === def.streamId) as
          | { uptime?: string; cpu?: number; memory?: string }
          | undefined
        return (
          <FeaturedSrtPipelineCard
            key={def.streamId}
            def={def}
            isLoading={isLoading}
            isLive={Boolean(pipelineLiveById[def.streamId])}
            uptime={row?.uptime}
            cpu={row?.cpu}
            memory={row?.memory}
          />
        )
      })}
    </div>
  )
}

/** @deprecated Utiliser `DashboardFeaturedSrtPipelines`. */
export function DashboardToubatvSrt() {
  return <DashboardFeaturedSrtPipelines />
}
