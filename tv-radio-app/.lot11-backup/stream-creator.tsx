"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { Plus, Loader2, Copy, Check, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { StreamHealthBadge } from "@/components/streams/StreamHealthBadge"
import { isNativeSrsSrtPort } from "@/lib/srt-ports"

interface CreatedLinks {
  name: string
  streamId?: string
  type: "rtmp" | "srt"
  srtMode?: "hls" | "relay"
  rtmpMode?: "hls" | "restream"
  ingestUrl: string
  playbackUrl: string
  playbackUrls?: string[]
  hlsUrl?: string | null
  restreamOutputUrl?: string
  note?: string
}

export function StreamCreator() {
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [createdLinks, setCreatedLinks] = useState<CreatedLinks | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'rtmp' as 'rtmp' | 'srt' | 'icecast',
    srtMode: 'hls' as 'hls' | 'relay',
    inputPort: '',
    outputPort: '',
    relayExtraPorts: '',
    relayOutputCount: '2',
    streamKey: '',
    passphrase: '',
    streamId: '',
    latency: '2000',
    autoPort: false,
    srtCopy: false,
    rtmpOutputMode: "hls" as "hls" | "restream",
    restreamOutputUrl: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.type === "icecast") {
      return
    }
    const isRtmp = formData.type === "rtmp"
    const isRelaySrt = !isRtmp && formData.srtMode === "relay"
    const inPortNum = parseInt(formData.inputPort, 10)
    const isNativeSrsHls =
      !isRtmp &&
        formData.srtMode === "hls" &&
        isNativeSrsSrtPort(inPortNum) &&
        !formData.autoPort
    if (!isRtmp && !isNativeSrsHls && !formData.passphrase.trim()) {
      toast.error("Passphrase SRT requise", {
        description: "Sauf flux HLS natif SRS (:7100 / :7000), une passphrase est obligatoire.",
      })
      return
    }
    if (isRelaySrt && isNativeSrsSrtPort(inPortNum) && !formData.autoPort) {
      toast.error("Port d’entrée incompatible", {
        description: "Le relay SRT utilise FFmpeg sur des ports UDP dédiés (ex. 6000–6100), pas :7100 / :7000 réservés au SRS natif.",
      })
      return
    }
    const inPort = formData.autoPort && !isRtmp ? 0 : inPortNum
    const needsRtmpHlsOut = isRtmp && formData.rtmpOutputMode === "hls"
    const needsSrtRelayOut = isRelaySrt && !formData.autoPort
    const needsManualOut = needsRtmpHlsOut || needsSrtRelayOut
    const outPort = needsRtmpHlsOut ? parseInt(formData.outputPort, 10) : NaN
    const relayFirstOut = needsSrtRelayOut ? parseInt(formData.outputPort, 10) : NaN
    if ((!formData.autoPort || isRtmp) && !Number.isFinite(inPort)) {
      toast.error("Ports invalides", { description: "Veuillez renseigner un port d'entrée valide." })
      return
    }
    if (needsSrtRelayOut && !Number.isFinite(relayFirstOut)) {
      toast.error("Ports invalides", { description: "Indiquez au moins un port de sortie SRT pour le relay." })
      return
    }
    if (needsSrtRelayOut) {
      const extras = formData.relayExtraPorts
        .split(/[\s,]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
      const relayOuts = [...new Set([relayFirstOut, ...extras])]
      if (relayOuts.some((p) => p === inPortNum)) {
        toast.error("Ports invalides", { description: "Les ports de sortie doivent être différents du port d’entrée." })
        return
      }
    }
    if (isRtmp && formData.rtmpOutputMode === "restream" && !formData.restreamOutputUrl.trim()) {
      toast.error("URL de restream requise", {
        description: "Indiquez la destination rtmp:// ou rtmps:// (copy sans transcodage).",
      })
      return
    }
    if (needsRtmpHlsOut && !Number.isFinite(outPort)) {
      toast.error("Ports invalides", { description: "Port de sortie requis pour ce mode." })
      return
    }
    if (needsRtmpHlsOut && Number.isFinite(inPort) && inPort === outPort) {
      toast.error("Ports invalides", { description: "Le port d'entrée et de sortie doivent être différents." })
      return
    }
    setLoading(true)

    try {
      let relayOutputsBody: Array<{ port: number }> | undefined
      if (isRelaySrt && formData.autoPort) {
        const n = Math.max(1, parseInt(formData.relayOutputCount, 10) || 1)
        relayOutputsBody = Array.from({ length: n }, () => ({ port: 1 }))
      } else if (isRelaySrt && !formData.autoPort) {
        const primary = parseInt(formData.outputPort, 10)
        const extras = formData.relayExtraPorts
          .split(/[\s,]+/)
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n) && n > 0)
        relayOutputsBody = [...new Set([primary, ...extras])].map((p) => ({ port: p }))
      }

      const response = await apiFetch(isRtmp ? '/api/streams/rtmp' : '/api/streams/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          ...(isRtmp ? {} : { type: formData.type, srtMode: formData.srtMode }),
          ...(!isRtmp && formData.autoPort ? { autoPort: true } : {}),
          ...((isRtmp || !formData.autoPort) && {
            inputPort: parseInt(formData.inputPort, 10),
          }),
          ...(isRtmp &&
            formData.rtmpOutputMode === 'hls' && {
              outputPort: formData.outputPort ? parseInt(formData.outputPort, 10) : undefined,
            }),
          ...(isRtmp && {
            mode: formData.rtmpOutputMode,
            ...(formData.rtmpOutputMode === 'restream'
              ? { restreamOutputUrl: formData.restreamOutputUrl.trim() }
              : {}),
          }),
          ...(isRelaySrt && relayOutputsBody?.length ? { outputs: relayOutputsBody } : {}),
          streamKey: formData.streamKey || undefined,
          ...(!isRtmp && {
            passphrase: formData.passphrase || undefined,
            streamId: formData.streamId.trim() || undefined,
            latency: formData.latency ? parseInt(formData.latency, 10) : undefined,
            ...(formData.srtMode === "hls" ? { srtCopy: formData.srtCopy } : {}),
          }),
        }),
      })

      const data = await response.json()

      if (data.success) {
        const streamId = data?.stream?.id || data?.id || formData.name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
        const outputPort = formData.outputPort ? parseInt(formData.outputPort, 10) : undefined
        const streamKey = formData.streamKey || streamId
        const ingestUrl = isRtmp
          ? `rtmp://stream.broadcastsn.com:${parseInt(formData.inputPort, 10)}/live/${streamKey}`
          : (data.ingestUrl || `srt://stream.broadcastsn.com:${parseInt(formData.inputPort, 10)}`)
        const isRtmpRestream = isRtmp && formData.rtmpOutputMode === "restream"
        const isSrtRelay = !isRtmp && formData.srtMode === "relay"
        const playbackUrlsSrt =
          isSrtRelay && Array.isArray(data.playbackUrls) && data.playbackUrls.length > 0
            ? (data.playbackUrls as string[])
            : undefined
        const playbackUrl = isRtmpRestream
          ? formData.restreamOutputUrl.trim()
          : isRtmp
            ? `rtmp://stream.broadcastsn.com:${outputPort}/live/${streamId}_out`
            : isSrtRelay
              ? (typeof data.playbackUrl === "string" ? data.playbackUrl : "")
              : (data.playbackUrl || "")
        const hlsUrl = isRtmpRestream
          ? null
          : isRtmp
            ? `https://stream.broadcastsn.com/rtmp-hls/${streamId}/stream.m3u8`
            : isSrtRelay
              ? null
              : (data.hlsUrl || null)

        setCreatedLinks({
          name: formData.name,
          streamId,
          type: formData.type,
          srtMode: formData.type === "srt" ? formData.srtMode : undefined,
          rtmpMode: isRtmp ? formData.rtmpOutputMode : undefined,
          ingestUrl,
          playbackUrl,
          playbackUrls: playbackUrlsSrt,
          hlsUrl,
          restreamOutputUrl: isRtmpRestream ? formData.restreamOutputUrl.trim() : undefined,
          note: data.note,
        })
        toast.success(`Flux ${formData.name} créé avec succès!`, {
          description: "Liens encodeur et lecture générés ci-dessous",
          duration: 5000,
        })
        setFormData({
          name: '',
          type: 'rtmp',
          srtMode: 'hls',
          inputPort: '',
          outputPort: '',
          relayExtraPorts: '',
          relayOutputCount: '2',
          streamKey: '',
          passphrase: '',
          streamId: '',
          latency: '2000',
          autoPort: false,
          srtCopy: false,
          rtmpOutputMode: "hls",
          restreamOutputUrl: "",
        })
        // Rafraîchir la liste sans recharger la page
        setTimeout(() => {
          window.dispatchEvent(new Event('streams-updated'))
        }, 500)
      } else {
        toast.error('Erreur lors de la création', {
          description: data.error || 'Une erreur est survenue',
          duration: 5000,
        })
      }
    } catch (error: any) {
      toast.error('Erreur', {
        description: error.message || 'Une erreur inattendue est survenue',
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  const copyValue = async (value: string, id: string, label: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopiedId(id)
      toast.success(`${label} copié`)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      toast.error("Copie impossible")
    }
  }

  const renderCopyRow = (id: string, label: string, value: string) => (
    <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-[#0a121e] p-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <code className="block truncate text-[11px] text-foreground/90 sm:text-xs">{value || "N/A"}</code>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-border/80 bg-[#111c2c] text-foreground/90 hover:bg-[#17263b]"
        disabled={!value}
        onClick={() => copyValue(value, id, label)}
      >
        {copiedId === id ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
        Copier
      </Button>
    </div>
  )

  return (
    <Card className="space-y-6 border-border/80 bg-card p-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Créer un nouveau flux</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          RTMP et SRT : création via l’API. Icecast : mountpoints et sources sur la page dédiée.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {formData.type !== "icecast" ? (
          <div className="space-y-2">
            <Label htmlFor="name">Nom du Flux</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="ex: Mon Stream"
              required
            />
          </div>
          ) : null}

          <div className={`space-y-2 ${formData.type === "icecast" ? "md:col-span-2" : ""}`}>
            <Label htmlFor="type">Type de Flux</Label>
            <Select
              value={formData.type}
              onValueChange={(value: 'rtmp' | 'srt' | 'icecast') =>
                setFormData({
                  ...formData,
                  type: value,
                  srtMode: value === "srt" ? formData.srtMode : "hls",
                  rtmpOutputMode: value === "rtmp" ? formData.rtmpOutputMode : "hls",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rtmp">RTMP</SelectItem>
                <SelectItem value="srt">SRT</SelectItem>
                <SelectItem value="icecast">Icecast</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.type === "icecast" ? (
            <div className="md:col-span-2 space-y-3 rounded-lg border border-border/80 bg-[#0d1624] p-4 text-sm text-muted-foreground">
              <p>
                Le protocole <strong className="text-foreground">Icecast</strong> est servi par le service{" "}
                <code className="text-xs text-muted-foreground">icecast2</code> sur le VPS. Les mountpoints, identifiants source
                et métadonnées se configurent sur la page <strong className="text-foreground">Sources Icecast</strong>, pas
                via la création RTMP/SRT ci-dessous.
              </p>
              <Button type="button" asChild className="bg-primary text-primary-foreground hover:brightness-110">
                <Link href="/icecast" className="inline-flex items-center gap-2">
                  Ouvrir Sources Icecast
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : null}

          {formData.type === 'srt' ? (
            <div className="space-y-2">
              <Label htmlFor="srt-mode">Mode SRT</Label>
              <Select
                value={formData.srtMode}
                onValueChange={(value: 'hls' | 'relay') =>
                  setFormData({ ...formData, srtMode: value })
                }
              >
                <SelectTrigger id="srt-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hls">SRT → HLS (FFmpeg ou SRS natif :7100 / :7000)</SelectItem>
                  <SelectItem value="relay">Relay SRT → plusieurs sorties SRT (copy, sans transcodage)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {formData.type === "srt" && (
            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-foreground/90">
                <input
                  type="checkbox"
                  checked={formData.autoPort}
                  onChange={(e) => setFormData({ ...formData, autoPort: e.target.checked })}
                  className="rounded border-border/80"
                />
                Ports UDP automatiques (plage serveur 6000–6100)
              </label>
            </div>
          )}

          {formData.type !== "icecast" ? (
          <div className="space-y-2">
            <Label htmlFor="inputPort">Port Input</Label>
            <Input
              id="inputPort"
              type="number"
              value={formData.inputPort}
              onChange={(e) => setFormData({ ...formData, inputPort: e.target.value })}
              placeholder={formData.type === 'rtmp' ? '1935' : '6000'}
              required={formData.type === "rtmp" || !formData.autoPort}
              disabled={formData.type === "srt" && formData.autoPort}
            />
          </div>
          ) : null}

          {formData.type === "rtmp" && (
            <div className="space-y-2 md:col-span-2">
              <Label>Mode sortie RTMP</Label>
              <Select
                value={formData.rtmpOutputMode}
                onValueChange={(value: "hls" | "restream") =>
                  setFormData({ ...formData, rtmpOutputMode: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hls">RTMP → HLS (fichiers locaux + Nginx)</SelectItem>
                  <SelectItem value="restream">RTMP → RTMP (FFmpeg -c copy vers une URL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.type === "rtmp" && formData.rtmpOutputMode === "hls" ? (
            <div className="space-y-2">
              <Label htmlFor="outputPort">Port Output</Label>
              <Input
                id="outputPort"
                type="number"
                value={formData.outputPort}
                onChange={(e) => setFormData({ ...formData, outputPort: e.target.value })}
                placeholder={formData.type === 'rtmp' ? '1936' : '6002'}
                required={
                  (formData.type === "rtmp" && formData.rtmpOutputMode === "hls")
                }
              />
            </div>
          ) : null}

          {formData.type === "srt" && formData.srtMode === "relay" && formData.autoPort ? (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="relayOutputCount">Nombre de sorties SRT</Label>
              <Input
                id="relayOutputCount"
                type="number"
                min={1}
                value={formData.relayOutputCount}
                onChange={(e) => setFormData({ ...formData, relayOutputCount: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Les ports UDP entrant + sorties seront attribués automatiquement dans la plage serveur.
              </p>
            </div>
          ) : null}

          {formData.type === "srt" && formData.srtMode === "relay" && !formData.autoPort ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="srtRelayOut1">Premier port sortie SRT</Label>
                <Input
                  id="srtRelayOut1"
                  type="number"
                  value={formData.outputPort}
                  onChange={(e) => setFormData({ ...formData, outputPort: e.target.value })}
                  placeholder="6002"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="relayExtraPorts">Ports sortie supplémentaires (optionnel)</Label>
                <Input
                  id="relayExtraPorts"
                  value={formData.relayExtraPorts}
                  onChange={(e) => setFormData({ ...formData, relayExtraPorts: e.target.value })}
                  placeholder="6004, 6006 ou 6004 6005"
                />
                <p className="text-xs text-muted-foreground">
                  Séparés par une virgule ou un espace. Même passphrase et latence pour toutes les sorties.
                </p>
              </div>
            </>
          ) : null}

          {formData.type === "rtmp" && formData.rtmpOutputMode === "restream" && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="restreamOutputUrl">URL destination RTMP</Label>
              <Input
                id="restreamOutputUrl"
                value={formData.restreamOutputUrl}
                onChange={(e) => setFormData({ ...formData, restreamOutputUrl: e.target.value })}
                placeholder="rtmp://live.example.com/app/streamKey"
                required
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Pas de HLS local : FFmpeg ré-encode en flux FLV vers cette URL (codecs source compatibles).
              </p>
            </div>
          )}

          {formData.type === "srt" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="passphrase">Passphrase SRT</Label>
                <Input
                  id="passphrase"
                  type="password"
                  autoComplete="off"
                  value={formData.passphrase}
                  onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                  placeholder={
                    formData.srtMode === "hls" &&
                    isNativeSrsSrtPort(parseInt(formData.inputPort, 10))
                      ? "Optionnel (SRS natif)"
                      : "Obligatoire"
                  }
                  required={
                    !(
                      formData.srtMode === "hls" &&
                      isNativeSrsSrtPort(parseInt(formData.inputPort, 10)) &&
                      !formData.autoPort
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="streamId">Stream ID (optionnel)</Label>
                <Input
                  id="streamId"
                  value={formData.streamId}
                  onChange={(e) => setFormData({ ...formData, streamId: e.target.value })}
                  placeholder="ex: publish/live"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="latency">Latence ms</Label>
                <Input
                  id="latency"
                  type="number"
                  value={formData.latency}
                  onChange={(e) => setFormData({ ...formData, latency: e.target.value })}
                />
              </div>
              {formData.srtMode === "hls" && (
                <div className="space-y-2 md:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-foreground/90">
                    <input
                      type="checkbox"
                      checked={formData.srtCopy}
                      onChange={(e) => setFormData({ ...formData, srtCopy: e.target.checked })}
                      className="rounded border-border/80"
                    />
                    Sans transcodage (-c copy) si codecs compatibles HLS
                  </label>
                </div>
              )}
            </>
          )}

          {formData.type === 'rtmp' && (
            <div className="space-y-2">
              <Label htmlFor="streamKey">Stream Key (optionnel)</Label>
              <Input
                id="streamKey"
                value={formData.streamKey}
                onChange={(e) => setFormData({ ...formData, streamKey: e.target.value })}
                placeholder="Laisser vide pour utiliser le nom"
              />
            </div>
          )}
        </div>

        {formData.type !== "icecast" ? (
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Création en cours...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Créer le Flux
            </>
          )}
        </Button>
        ) : null}
      </form>
      {createdLinks && (
        <div className="space-y-2 rounded-xl border border-border/80 bg-[#0d1624] p-4">
          <p className="font-semibold text-white">
            Liens générés - {createdLinks.name} ({createdLinks.type.toUpperCase()})
          </p>
          {createdLinks.streamId &&
          (createdLinks.hlsUrl || (createdLinks.type === "rtmp" && createdLinks.rtmpMode !== "restream")) ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Test lecture :</span>
              <StreamHealthBadge streamId={createdLinks.streamId} />
            </div>
          ) : null}
          {renderCopyRow("encoder", "Lien encodeur", createdLinks.ingestUrl)}
          {createdLinks.type === "rtmp" && createdLinks.rtmpMode !== "restream" && renderCopyRow("hls", "Lien lecture HLS", createdLinks.hlsUrl || "")}
          {createdLinks.type === "rtmp" && createdLinks.rtmpMode === "restream" && renderCopyRow("restream-out", "Destination restream", createdLinks.restreamOutputUrl || createdLinks.playbackUrl)}
          {createdLinks.type === "rtmp" && createdLinks.rtmpMode !== "restream" && renderCopyRow("rtmp", "Lien lecture RTMP (sortie locale)", createdLinks.playbackUrl)}
          {createdLinks.type === "srt" && createdLinks.srtMode === "hls" &&
            renderCopyRow("hls-srt", "Lien lecture HLS", createdLinks.hlsUrl || "")}
          {createdLinks.type === "srt" && createdLinks.srtMode === "relay" && (
            <>
              {(createdLinks.playbackUrls?.length
                ? createdLinks.playbackUrls
                : [createdLinks.playbackUrl].filter(Boolean)
              ).map((url, i) =>
                renderCopyRow(`srt-relay-${i}`, `Sortie SRT ${i + 1}`, url)
              )}
            </>
          )}
          {createdLinks.note && (
            <p className="text-xs text-muted-foreground">{createdLinks.note}</p>
          )}
        </div>
      )}
    </Card>
  )
}
