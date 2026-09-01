"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EndpointRow } from "@/components/EndpointRow"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { PageHeader } from "@/components/shell/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Link2 } from "lucide-react"

type Channel = {
  name: string
  protocol: "SRT" | "RTMP" | "ICECAST"
  srtPort?: number
  hlsUrl?: string
  hlsAvailable?: boolean
  ingestUrl?: string
  hlsPath?: string
}

export default function EndpointsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const run = async () => {
      const res = await apiFetch("/api/endpoints", { cache: "no-store" })
      const json = await res.json()
      setChannels(json.channels || [])
      setLoaded(true)
    }
    run()
  }, [])

  const copyAll = async () => {
    const payload = channels
      .map((c) => [c.name, c.ingestUrl, c.hlsUrl, c.hlsPath].filter(Boolean).join("\n"))
      .join("\n\n")
    await navigator.clipboard.writeText(payload)
    toast.success("Copié dans le presse-papiers")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Endpoints / Liens"
        description="Points de diffusion — stream.broadcastsn.com"
        actions={
          <Button onClick={copyAll} variant="outline" className="border-border bg-card">
            Tout copier
          </Button>
        }
      />

      {loaded && channels.length === 0 ? (
        <EmptyState
          icon={<Link2 className="h-8 w-8" />}
          title="Aucun canal"
          description="Aucun endpoint n'a été renvoyé par l'API."
        />
      ) : null}

      {channels.map((channel) => (
        <Card key={channel.name} className="border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{channel.name}</CardTitle>
            <div className="text-xs text-muted-foreground">
              {channel.protocol}
              {channel.srtPort ? ` :${channel.srtPort}` : ""}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {channel.ingestUrl ? (
              <EndpointRow
                label="Ingest"
                value={channel.ingestUrl}
                live={Boolean(channel.hlsAvailable)}
              />
            ) : null}
            {channel.hlsUrl ? (
              <EndpointRow
                label="HLS Output"
                value={channel.hlsUrl}
                live={Boolean(channel.hlsAvailable)}
              />
            ) : null}
            {channel.hlsPath ? (
              <EndpointRow
                label="HLS Path"
                value={channel.hlsPath}
                live={Boolean(channel.hlsAvailable)}
              />
            ) : null}
          </CardContent>
        </Card>
      ))}

      <Card className="border-border/80 bg-card">
        <CardHeader>
          <CardTitle className="text-base">RTMP Apps dakar / live</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <EndpointRow
            label="RTMP Ingest dakar"
            value="rtmp://stream.broadcastsn.com:1935/dakar/<STREAM_KEY>"
            live
          />
          <EndpointRow
            label="RTMP Ingest live"
            value="rtmp://stream.broadcastsn.com:1935/live/<STREAM_KEY>"
            live
          />
          <EndpointRow
            label="HLS live"
            value="https://stream.broadcastsn.com/live-hls/<KEY>/index.m3u8"
            live
          />
          <EndpointRow label="Oryx/SRS" value="https://stream.broadcastsn.com/mgmt/" live />
        </CardContent>
      </Card>
    </div>
  )
}
