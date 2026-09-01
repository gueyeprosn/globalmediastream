"use client"

import { StreamCard } from "./stream-card"
import type { Stream } from "@/types/streams"
import { Card, CardContent } from "@/components/ui/card"
import { Radio, Video, Music } from "lucide-react"

const PROTOCOL_LABELS = {
  srt: "SRT",
  rtmp: "RTMP",
  icecast: "Icecast",
} as const

const PROTOCOL_ICONS = { srt: Radio, rtmp: Video, icecast: Music }

interface StreamListProps {
  streams: Stream[]
  protocol: "srt" | "rtmp" | "icecast"
  onEdit: (stream: Stream) => void
  emptyStateAction?: React.ReactNode
}

export function StreamList({ streams, protocol, onEdit, emptyStateAction }: StreamListProps) {
  if (streams.length === 0) {
    const Icon = PROTOCOL_ICONS[protocol]
    const label = PROTOCOL_LABELS[protocol]
    return (
      <Card className="border-border/80 bg-card">
        <CardContent className="py-16 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-muted/40 p-4">
              <Icon className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>
          <h3 className="mb-1 font-semibold text-white">
            Aucun flux {label} configuré
          </h3>
          <p className="mx-auto mb-6 max-w-sm text-sm text-muted-foreground">
            Ajoutez votre premier stream {label} pour commencer la diffusion.
          </p>
          {emptyStateAction}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {streams.map((stream) => (
        <StreamCard
          key={stream.id}
          stream={stream}
          onEdit={onEdit}
        />
      ))}
    </div>
  )
}

