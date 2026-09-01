"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MonitorPlay, ExternalLink } from "lucide-react"
import { PageHeader } from "@/components/shell/page-header"

const SRS_CONSOLE_URL = "https://stream.broadcastsn.com/mgmt/"

export default function SrsConsolePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Console SRS"
        description="Console Oryx locale — supervision et actions sur SRS"
        actions={
          <Button variant="outline" size="sm" className="border-border bg-card" asChild>
            <a href={SRS_CONSOLE_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Ouvrir Oryx
            </a>
          </Button>
        }
      />

      <Card className="border-border/80 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MonitorPlay className="h-5 w-5" />
            Console embarquée
          </CardTitle>
          <CardDescription>
            Si l&apos;iframe ne s&apos;affiche pas (CORS), ouvrez la console dans un nouvel onglet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="overflow-hidden rounded-lg border border-border/80 bg-muted/20"
            style={{ minHeight: "70vh" }}
          >
            <iframe
              src={SRS_CONSOLE_URL}
              title="Oryx SRS Console"
              className="h-[70vh] w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            API SRS locale :{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">http://127.0.0.1:1985</code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
