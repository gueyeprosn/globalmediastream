"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api-fetch"
import { isNativeSrsSrtPort } from "@/lib/srt-ports"

type StreamModalProps = {
  isOpen: boolean
  onClose: () => void
  onCreated?: (name: string) => void
}

function slugify(v: string) {
  return v.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

export function StreamModal({ isOpen, onClose, onCreated }: StreamModalProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [name, setName] = useState("")
  const [protocol, setProtocol] = useState<"SRT" | "RTMP" | "ICECAST">("SRT")
  const [srtMode, setSrtMode] = useState("hls")
  const [inputPort, setInputPort] = useState("7100")
  const [outputPort, setOutputPort] = useState("6002")
  const [relayExtraPorts, setRelayExtraPorts] = useState("")
  const [streamKey, setStreamKey] = useState("")
  const [srtPassphrase, setSrtPassphrase] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (protocol === "ICECAST") return
    if (protocol === "RTMP" && !["1935"].includes(inputPort)) {
      setInputPort("1935")
      return
    }
    if (protocol !== "SRT") return
    if (srtMode === "relay") return
    if (!["7100", "7000"].includes(inputPort)) {
      setInputPort("7100")
    }
  }, [protocol, inputPort, srtMode])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    const suggestName = (usedSlugs: Set<string>) => {
      let index = 1
      while (usedSlugs.has(`nouveau-flux-${index}`)) index += 1
      return `Nouveau flux ${index}`
    }

    const loadDefaults = async () => {
      try {
        const res = await apiFetch("/api/streams", { cache: "no-store" })
        const data = res.ok ? await res.json() : { streams: [] }
        const list = Array.isArray(data.streams) ? data.streams : []

        const usedSlugs = new Set<string>()
        for (const item of list) {
          const base = String(item?.id || item?.name || "").trim()
          if (base) usedSlugs.add(slugify(base))
        }

        if (cancelled) return

        if (!name.trim()) setName(suggestName(usedSlugs))

        if (protocol === "ICECAST") {
          /* ports Icecast gérés sur /icecast */
        } else if (protocol === "SRT" && srtMode === "hls") {
          setInputPort("7100")
        } else if (protocol === "RTMP") {
          setInputPort("1935")
        }
      } catch {
        if (cancelled) return
        if (!name.trim()) setName("Nouveau flux 1")
      }
    }

    loadDefaults()

    return () => {
      cancelled = true
    }
  }, [isOpen, protocol, srtMode])

  const nativeSrsHls =
    protocol === "SRT" && srtMode === "hls" && isNativeSrsSrtPort(Number(inputPort))

  const slug = useMemo(() => slugify(name || "nouveau-flux") || "nouveau-flux", [name])
  const nativeSrsStreamId = useMemo(() => `#!::r=live/${slug},m=publish`, [slug])

  const preview = useMemo(() => {
    if (protocol === "SRT") {
      const baseIngest = `srt://stream.broadcastsn.com:${inputPort}`
      const ingest = nativeSrsHls
        ? `${baseIngest}?streamid=${encodeURIComponent(nativeSrsStreamId)}`
        : baseIngest
      const hls =
        srtMode === "hls"
          ? isNativeSrsSrtPort(Number(inputPort))
            ? `https://stream.broadcastsn.com/live/${slug}/index.m3u8`
            : `https://stream.broadcastsn.com/rtmp-hls/${slug}/stream.m3u8`
          : ""
      let relayLines: string[] = []
      if (srtMode === "relay") {
        const first = Number(outputPort)
        const extras = relayExtraPorts
          .split(/[\s,]+/)
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n) && n > 0)
        relayLines = [...new Set([first, ...extras].filter((n) => Number.isFinite(n) && n > 0))].map(
          (p) => `srt://stream.broadcastsn.com:${p}`
        )
      }
      return { ingest, hls, relayLines }
    }
    const rtmpKey = slugify(streamKey || name || "stream-key") || "stream-key"
    const ingest = `rtmp://stream.broadcastsn.com:${inputPort}/live/${rtmpKey}`
    const hls = `https://stream.broadcastsn.com/rtmp-hls/${slug}/stream.m3u8`
    return { ingest, hls, relayLines: [] as string[] }
  }, [name, protocol, srtMode, inputPort, outputPort, relayExtraPorts, streamKey, nativeSrsHls, nativeSrsStreamId, slug])

  const copy = async () => {
    await navigator.clipboard.writeText(preview.ingest)
    toast.success("Copié dans le presse-papiers")
  }

  const goIcecast = () => {
    onClose()
    router.push("/icecast")
  }

  const handleCreate = async () => {
    if (protocol === "ICECAST") {
      goIcecast()
      return
    }
    const cleanName = name.trim()
    if (!cleanName) {
      toast.error("Le nom du flux est requis")
      return
    }
    const inNum = Number(inputPort)
    if (protocol === "SRT" && srtMode === "relay") {
      if (!srtPassphrase.trim()) {
        toast.error("Passphrase SRT obligatoire pour le relay")
        return
      }
      if (isNativeSrsSrtPort(inNum)) {
        toast.error("Relay : utilisez un port UDP dédié (ex. 6000–6100), pas :7100 / :7000")
        return
      }
      const firstOut = Number(outputPort)
      if (!Number.isFinite(firstOut) || firstOut <= 0) {
        toast.error("Indiquez au moins un port de sortie SRT valide")
        return
      }
      const extras = relayExtraPorts
        .split(/[\s,]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
      const outs = [...new Set([firstOut, ...extras])]
      if (outs.some((p) => p === inNum)) {
        toast.error("Les ports de sortie doivent être différents du port d'entrée")
        return
      }
    }
    if (protocol === "SRT" && !nativeSrsHls && !srtPassphrase.trim()) {
      toast.error("Passphrase SRT requise (sauf flux HLS natif SRS :7100/:7000)")
      return
    }
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        name: cleanName,
        type: protocol.toLowerCase(),
        inputPort: Number(inputPort),
      }
      if (protocol === "SRT") {
        payload.srtMode = srtMode
        if (nativeSrsHls) payload.streamId = nativeSrsStreamId
        if (srtMode === "relay") {
          const firstOut = Number(outputPort)
          const extras = relayExtraPorts
            .split(/[\s,]+/)
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => Number.isFinite(n) && n > 0)
          payload.outputs = [...new Set([firstOut, ...extras])].map((p) => ({ port: p }))
        }
        if (srtPassphrase.trim()) payload.passphrase = srtPassphrase.trim()
      } else {
        payload.streamKey = slugify(streamKey || cleanName)
      }

      const res = await apiFetch("/api/streams/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Création du flux impossible")

      toast.success("Flux créé avec succès")
      onCreated?.(cleanName)
      onClose()
      if (pathname !== "/streams") {
        router.push(`/streams?created=${encodeURIComponent(cleanName)}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl border-border/80 bg-card">
        <DialogHeader>
          <DialogTitle>Nouveau flux SRS</DialogTitle>
          <DialogDescription>
            {protocol === "ICECAST"
              ? "Icecast utilise le service icecast2 sur le VPS ; les mountpoints se gèrent sur la page Sources Icecast."
              : "Créez un flux et récupérez immédiatement les URLs d'ingest et de lecture."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3">
          {protocol !== "ICECAST" ? (
            <div className="space-y-1">
              <Label>Nom du canal</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="border-border/80 bg-[var(--input)]" />
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className={`space-y-1 ${protocol === "ICECAST" ? "sm:col-span-2" : ""}`}>
              <Label>Protocole</Label>
              <Select
                value={protocol}
                onValueChange={(p: "SRT" | "RTMP" | "ICECAST") => {
                  setProtocol(p)
                  if (p === "SRT") {
                    setSrtMode("hls")
                    setInputPort("7100")
                  } else if (p === "RTMP") {
                    setInputPort("1935")
                  }
                }}
              >
                <SelectTrigger className="border-border/80 bg-[var(--input)]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SRT">SRT</SelectItem>
                  <SelectItem value="RTMP">RTMP</SelectItem>
                  <SelectItem value="ICECAST">Icecast</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {protocol === "ICECAST" ? null : (
            <div className="space-y-1">
              <Label>Port d'entrée</Label>
              {protocol === "SRT" && srtMode === "relay" ? (
                <Input
                  type="number"
                  value={inputPort}
                  onChange={(e) => setInputPort(e.target.value)}
                  className="border-border/80 bg-[var(--input)]"
                  placeholder="ex: 6010"
                  min={1}
                />
              ) : (
                <Select value={inputPort} onValueChange={setInputPort}>
                  <SelectTrigger className="border-border/80 bg-[var(--input)]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {protocol === "SRT" ? (
                      <>
                        <SelectItem value="7100">SRT :7100 (SRS natif)</SelectItem>
                        <SelectItem value="7000">SRT :7000 (legacy)</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="1935">RTMP :1935</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
            )}
          </div>
          {protocol === "ICECAST" ? (
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-sm text-muted-foreground">
              <p>
                Les sources audio (mountpoints, mots de passe source, métadonnées) ne passent pas par la même API que RTMP/SRT.
                Utilisez la page <strong className="text-foreground">Sources Icecast</strong> pour les ajouter ou les modifier.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Écoute typique : <code className="text-muted-foreground">https://stream.broadcastsn.com:8000/&lt;mount&gt;</code> (selon votre <code className="text-muted-foreground">icecast.xml</code>).
              </p>
            </div>
          ) : null}
          {protocol === "SRT" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Mode SRT</Label>
                <Select
                  value={srtMode}
                  onValueChange={(m) => {
                    setSrtMode(m)
                    if (m === "relay") {
                      setInputPort("6010")
                      setOutputPort("6012")
                    } else {
                      setInputPort("7100")
                      setRelayExtraPorts("")
                    }
                  }}
                >
                  <SelectTrigger className="border-border/80 bg-[var(--input)]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hls">SRT vers HLS</SelectItem>
                    <SelectItem value="relay">Relay SRT → plusieurs sorties SRT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {srtMode === "relay" ? (
                <>
                  <div className="space-y-1">
                    <Label>Premier port sortie SRT</Label>
                    <Input
                      type="number"
                      value={outputPort}
                      onChange={(e) => setOutputPort(e.target.value)}
                      className="border-border/80 bg-[var(--input)]"
                      placeholder="6012"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label>Ports sortie supplémentaires (optionnel)</Label>
                    <Input
                      value={relayExtraPorts}
                      onChange={(e) => setRelayExtraPorts(e.target.value)}
                      className="border-border/80 bg-[var(--input)]"
                      placeholder="6014, 6016"
                    />
                  </div>
                </>
              ) : null}
              <div className="sm:col-span-2 space-y-1">
                <Label>
                  Passphrase SRT{" "}
                  {nativeSrsHls ? "(optionnel, SRS :7100)" : "(obligatoire)"}
                </Label>
                <Input
                  type="password"
                  autoComplete="off"
                  value={srtPassphrase}
                  onChange={(e) => setSrtPassphrase(e.target.value)}
                  className="border-border/80 bg-[var(--input)]"
                  placeholder="Clé partagée avec l’encodeur"
                />
              </div>
            </div>
          ) : protocol === "RTMP" ? (
            <div className="space-y-1">
              <Label>Stream key RTMP (optionnel)</Label>
              <Input
                value={streamKey}
                onChange={(e) => setStreamKey(e.target.value)}
                placeholder="ex: event-live"
                className="border-border/80 bg-[var(--input)]"
              />
            </div>
          ) : null}
          {protocol !== "ICECAST" ? (
          <div className="rounded border border-border/80 bg-muted/30 p-3">
            <p className="mb-2 text-xs text-muted-foreground">Aperçu URLs</p>
            <code className="block font-mono text-xs text-foreground">Ingest: {preview.ingest}</code>
            {preview.hls ? <code className="mt-1 block font-mono text-xs text-emerald-200">HLS: {preview.hls}</code> : null}
            {preview.relayLines.map((line, i) => (
              <code key={`${line}-${i}`} className="mt-1 block font-mono text-xs text-amber-200">
                Relay {preview.relayLines.length > 1 ? `${i + 1}: ` : ""}
                {line}
              </code>
            ))}
            <Button size="sm" variant="outline" className="mt-2" onClick={copy}>Copier l'ingest</Button>
          </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Fermer</Button>
            {protocol === "ICECAST" ? (
              <Button onClick={goIcecast}>Ouvrir Sources Icecast</Button>
            ) : (
              <Button onClick={handleCreate} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Créer
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
