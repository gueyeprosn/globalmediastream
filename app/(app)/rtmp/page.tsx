"use client"

import { RTMPStreamManager } from "@/components/rtmp-stream-manager"
import { StreamCreator } from "@/components/stream-creator"
import { ActiveStreamsUnified } from "@/components/active-streams-unified"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import { PageHeader } from "@/components/shell/page-header"
import { Section } from "@/components/shared/section"

export default function RTMPStreamsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Flux RTMP"
        description="Gestion des flux, clés d'ingest et sorties de diffusion"
        actions={
          <Button asChild size="sm" variant="outline" className="gap-2 border-border bg-card">
            <Link href="/monitoring">
              Monitoring
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <Card className="border-border/80 bg-card">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            Créez vos flux RTMP/SRT ci-dessous, puis copiez les liens encodeur et de lecture.
          </p>
        </CardContent>
      </Card>

      <Section title="Création">
        <StreamCreator />
      </Section>
      <Section title="Flux actifs">
        <ActiveStreamsUnified />
      </Section>
      <Section title="Gestion RTMP">
        <RTMPStreamManager showTitle={false} />
      </Section>
    </div>
  )
}
