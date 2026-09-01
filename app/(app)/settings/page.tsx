"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { EndpointRow } from "@/components/EndpointRow"
import { useAppStore } from "@/stores/useAppStore"
import { OperatorGuide } from "@/components/ops/OperatorGuide"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/shell/page-header"
import { Section } from "@/components/shared/section"
import { useTheme } from "next-themes"

export default function SettingsPage() {
  const { settings, updateSettings, sidebarCollapsed, setSidebarCollapsed, setTheme } =
    useAppStore()
  const { setTheme: setNextTheme } = useTheme()
  const density = settings.uiDensity || "comfortable"
  const themePref = settings.theme || "system"

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration"
        description="Réglages interface, SRS, SRT systemd, Oryx et enregistrements"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border-border/80 bg-card xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Interface opérateur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div>
              <p className="mb-2 font-medium text-foreground/90">Thème</p>
              <div className="flex flex-wrap gap-2">
                {(["light", "dark", "system"] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    size="sm"
                    variant={themePref === mode ? "default" : "outline"}
                    onClick={() => {
                      updateSettings({ theme: mode })
                      setNextTheme(mode)
                      if (mode !== "system") setTheme(mode)
                      toast.success(
                        mode === "light"
                          ? "Mode clair"
                          : mode === "dark"
                            ? "Mode sombre"
                            : "Thème système"
                      )
                    }}
                  >
                    {mode === "light" ? "Clair" : mode === "dark" ? "Sombre" : "Système"}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-medium text-foreground/90">Densité des cartes</p>
              <div className="flex gap-2">
                {(["comfortable", "compact"] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    size="sm"
                    variant={density === mode ? "default" : "outline"}
                    onClick={() => {
                      updateSettings({ uiDensity: mode })
                      toast.success(
                        mode === "compact" ? "Mode compact activé" : "Mode confortable activé"
                      )
                    }}
                  >
                    {mode === "compact" ? "Compact" : "Confortable"}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-medium text-foreground/90">Barre latérale (desktop)</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setSidebarCollapsed(!sidebarCollapsed)
                  toast.info(
                    sidebarCollapsed ? "Barre latérale dépliée" : "Barre latérale réduite"
                  )
                }}
              >
                {sidebarCollapsed ? "Épingler / déplier" : "Réduire la barre"}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Utilisez l&apos;icône en haut de la sidebar pour garder le menu visible.
              </p>
            </div>
          </CardContent>
        </Card>
        <OperatorGuide className="xl:col-span-2" />
      </div>

      <Section title="Infrastructure">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="border-border/80 bg-card">
            <CardHeader>
              <CardTitle className="text-base">SRS Docker — ossrs/srs:6</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Domaine: stream.broadcastsn.com</p>
              <p>RTMP: 1935 · API: 1985 · HTTP: 8080 · SRT: 10080</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card">
            <CardHeader>
              <CardTitle className="text-base">SRT Systemd</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>ToubaTV 6000 · External 6001 · External2 6003 · External3 6005</p>
              <p>MemoryMax: 512M · Après modif: sudo systemctl daemon-reload</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card">
            <CardHeader>
              <CardTitle className="text-base">Oryx — ossrs/oryx:5</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Port interne: 2022</p>
              <p>Nginx proxy: /mgmt/ -&gt; 127.0.0.1:2022/</p>
              <p>MGMT password: ********</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card">
            <CardHeader>
              <CardTitle className="text-base">Enregistrements — /srv/recordings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Format FFmpeg: -c copy -y *.mkv</p>
              <p>State file: .recordings-state.json</p>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Card className={cn("border-border/80 bg-card")}>
        <CardHeader>
          <CardTitle className="text-base">Commandes rapides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            "cd /srv/srs && docker compose ps",
            "pm2 status oceanfm-app",
            "curl -sS https://stream.broadcastsn.com/terraform/v1/mgmt/envs",
            "nginx -t && systemctl reload nginx",
            "ls -lh /srv/recordings && cat /srv/recordings/.recordings-state.json",
            "sudo systemctl daemon-reload && systemctl restart toubatv external-tv",
          ].map((cmd) => (
            <EndpointRow key={cmd} label="shell" value={cmd} live />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
