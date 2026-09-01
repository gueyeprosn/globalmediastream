"use client"

import { StreamList } from "@/components/streams/stream-list"
import { StreamForm } from "@/components/streams/stream-form"
import { useState } from "react"
import { Plus, Radio, Users, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useStreams } from "@/hooks/useStreams"
import type { IcecastSource } from "@/types/streams"
import { PageHeader } from "@/components/shell/page-header"
import { Section } from "@/components/shared/section"

export default function IcecastSourcesPage() {
  const { data: streams } = useStreams()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingStream, setEditingStream] = useState<IcecastSource | null>(null)

  const icecastStreams = streams?.filter((s: any) => s.type === "icecast") || []

  const handleEdit = (stream: any) => {
    setEditingStream(stream as IcecastSource)
    setIsFormOpen(true)
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Sources Icecast"
          description="Gérer vos sources audio Icecast"
          actions={
            <Button onClick={() => setIsFormOpen(true)} className="bg-primary text-primary-foreground">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une source
            </Button>
          }
        />

        {icecastStreams.length > 0 && (
          <Section title="Écoute en direct (status-json)">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {icecastStreams.map((s: Record<string, unknown>) => {
                const listeners = typeof s.listeners === "number" ? s.listeners : 0
                const peak = typeof s.listenerPeak === "number" ? s.listenerPeak : 0
                const mount = (s.mountpoint as string) || "/"
                const live = s.status === "running" || s.status === "active"
                return (
                  <Card key={String(s.id)} className="border-border/80 bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-base text-foreground">
                        <span className="flex items-center gap-2 truncate">
                          <Radio className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate">{String(s.name || s.id)}</span>
                        </span>
                        <Badge
                          variant={live ? "default" : "secondary"}
                          className={live ? "bg-primary/15 text-primary" : ""}
                        >
                          {live ? "ON" : "OFF"}
                        </Badge>
                      </CardTitle>
                      <p className="truncate font-mono text-xs text-muted-foreground">{mount}</p>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          Auditeurs
                        </span>
                        <span className="font-mono font-semibold text-foreground">{listeners}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <TrendingUp className="h-3.5 w-3.5" />
                          Pic
                        </span>
                        <span className="font-mono">{peak}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Bitrate</span>
                        <span>{typeof s.bitrate === "number" ? `${s.bitrate} kbps` : "—"}</span>
                      </div>
                      {s.outputUrl ? (
                        <a
                          href={String(s.outputUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-xs text-primary hover:underline"
                        >
                          {String(s.outputUrl)}
                        </a>
                      ) : null}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </Section>
        )}

        <StreamList
          streams={icecastStreams}
          protocol="icecast"
          onEdit={handleEdit}
          emptyStateAction={
            <Button onClick={() => setIsFormOpen(true)} className="bg-primary text-primary-foreground hover:brightness-110">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une source Icecast
            </Button>
          }
        />

        {isFormOpen && (
          <StreamForm
            protocol="icecast"
            stream={editingStream}
            onClose={() => {
              setIsFormOpen(false)
              setEditingStream(null)
            }}
          />
        )}
      </div>
    </>
  )
}

