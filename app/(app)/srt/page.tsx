"use client"

import { useStreams } from "@/hooks/useStreams"
import { DashboardFeaturedSrtPipelines } from "@/components/dashboard/dashboard-toubatv-srt"
import { SRTStreamCard } from "@/components/streams/srt-stream-card"
import { Button } from "@/components/ui/button"
import { Radio } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/shell/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Section } from "@/components/shared/section"

export default function SRTStreamsPage() {
  const { data: streams = [], isLoading } = useStreams()
  const srtStreams = (streams as any[]).filter((s) => s.type === "srt" || s.protocol === "srt")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contrôle SRT"
        description="Gérer vos flux SRT (Secure Reliable Transport)"
        actions={
          <>
            <Button asChild size="sm" variant="outline" className="border-border bg-card">
              <Link href="/recordings">Enregistrements</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="border-border bg-card">
              <Link href="/monitoring">Qualité des flux</Link>
            </Button>
          </>
        }
      />

      <DashboardFeaturedSrtPipelines />

      <Section
        title="Flux SRT"
        description="Démarrer, arrêter ou redémarrer les pipelines configurés sur le serveur"
      >
        {isLoading ? (
          <EmptyState title="Chargement…" description="Récupération des flux SRT" />
        ) : srtStreams.length === 0 ? (
          <EmptyState
            icon={<Radio className="h-8 w-8" />}
            title="Aucun flux SRT configuré"
            description="Les flux SRT sont gérés côté serveur. Aucun flux n'est actuellement présent."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {srtStreams.map((stream) => (
              <SRTStreamCard
                key={stream.id}
                stream={{
                  id: stream.id,
                  name: stream.name,
                  status: stream.status,
                  srtInputUrl: stream.srtInputUrl || stream.inputUrl,
                  srtOutputUrl: stream.srtOutputUrl || stream.outputUrl,
                  srtOutputUrls: stream.srtOutputUrls,
                  hlsUrl: stream.hlsUrl,
                  inputPort: stream.inputPort,
                  outputPort: stream.outputPort,
                  uptime: stream.uptime,
                  cpu: stream.cpu,
                  memory: stream.memory,
                }}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
