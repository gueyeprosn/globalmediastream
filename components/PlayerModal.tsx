"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import Hls from "hls.js"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type PlayerModalProps = {
  isOpen: boolean
  onClose: () => void
  streamName: string
  ingestUrl: string
  hlsUrl: string
  protocol: string
  bitrate: string
  resolution: string
  fps: string
}

export function PlayerModal(props: PlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const isHls = props.hlsUrl.includes(".m3u8")
  const appendCacheBuster = (url: string) => {
    const separator = url.includes("?") ? "&" : "?"
    return `${url}${separator}_ts=${Date.now()}`
  }

  useEffect(() => {
    if (!props.isOpen || !isHls) return
    const video = videoRef.current
    if (!video) return

    setIsReady(false)
    setPlayerError(null)
    let ready = false
    const readyOnce = () => {
      if (ready) return
      ready = true
      setIsReady(true)
      setPlayerError(null)
    }
    const failTimer = setTimeout(() => {
      if (!ready) {
        setPlayerError("Flux indisponible ou trop lent. Clique sur Réessayer.")
      }
    }, 12000)
    const onLoaded = () => readyOnce()
    const onCanPlay = () => readyOnce()
    const onPlaying = () => readyOnce()
    video.addEventListener("loadedmetadata", onLoaded)
    video.addEventListener("canplay", onCanPlay)
    video.addEventListener("playing", onPlaying)

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = appendCacheBuster(props.hlsUrl)
      const onError = () => setPlayerError("Impossible de lire ce flux.")
      video.addEventListener("error", onError)
      video.play().catch(() => {
        // L'utilisateur peut lancer manuellement via controls.
      })
      return () => {
        clearTimeout(failTimer)
        video.removeEventListener("canplay", onCanPlay)
        video.removeEventListener("playing", onPlaying)
        video.removeEventListener("loadedmetadata", onLoaded)
        video.removeEventListener("error", onError)
        video.pause()
        video.removeAttribute("src")
        video.load()
      }
    }

    if (!Hls.isSupported()) {
      setPlayerError("Navigateur non compatible HLS.")
      return
    }

    const BaseLoader = Hls.DefaultConfig.loader
    class NoCachePlaylistLoader extends BaseLoader {
      load(context: any, config: any, callbacks: any) {
        const isPlaylist = typeof context?.url === "string" && context.url.includes(".m3u8")
        const nextContext = isPlaylist
          ? { ...context, url: appendCacheBuster(context.url) }
          : context
        super.load(nextContext, config, callbacks)
      }
    }

    const hls = new Hls({
      loader: NoCachePlaylistLoader as any,
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 90,
      maxBufferLength: 60,
      maxMaxBufferLength: 120,
      liveSyncDuration: 30,
      liveMaxLatencyDuration: 60,
    })

    hls.loadSource(props.hlsUrl)
    hls.attachMedia(video)
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      readyOnce()
      video.play().catch(() => {
        // L'utilisateur peut lancer manuellement via controls.
      })
    })
    hls.on(Hls.Events.FRAG_LOADED, () => readyOnce())
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        hls.startLoad()
        setPlayerError("Flux instable, nouvelle tentative...")
        return
      }
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError()
        setPlayerError("Récupération du média en cours...")
        return
      }
      setPlayerError("Erreur de lecture du flux.")
    })
    hlsRef.current = hls

    return () => {
      clearTimeout(failTimer)
      video.removeEventListener("loadedmetadata", onLoaded)
      video.removeEventListener("canplay", onCanPlay)
      video.removeEventListener("playing", onPlaying)
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      video.pause()
      video.removeAttribute("src")
      video.load()
    }
  }, [props.isOpen, props.hlsUrl, isHls, reloadToken])

  return (
    <Dialog open={props.isOpen} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-w-3xl border-border/80 bg-card">
        <DialogHeader>
          <DialogTitle>{props.streamName}</DialogTitle>
          <DialogDescription>
            Détails de diffusion et aperçu lecteur pour ce flux.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative aspect-video rounded-lg bg-black">
            <div className="absolute left-3 top-3 flex items-center gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-300">LIVE</Badge>
              <Badge className="bg-amber-500/15 text-amber-300">{isHls ? "HLS" : props.protocol}</Badge>
            </div>
            {isHls ? (
              <>
                <video
                  ref={videoRef}
                  className="h-full w-full rounded-lg object-contain"
                  controls
                  autoPlay
                  muted
                  playsInline
                />
                {!isReady && !playerError ? (
                  <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Chargement du flux...
                    </div>
                  </div>
                ) : null}
                {playerError ? (
                  <div className="absolute inset-0 grid place-items-center px-4 text-center">
                    <div className="space-y-3">
                      <p className="text-sm text-red-300">{playerError}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/40 bg-red-500/10 text-red-100 hover:bg-red-500/20"
                        onClick={() => setReloadToken((v) => v + 1)}
                      >
                        Réessayer
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="absolute inset-0 grid place-items-center px-4 text-center text-muted-foreground">
                Aperçu natif indisponible pour ce protocole. Utilise le lien de sortie ci-dessous.
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded border border-border/80 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">HLS URL</p>
              <code className="block truncate font-mono text-xs text-foreground">{props.hlsUrl}</code>
            </div>
            <div className="rounded border border-border/80 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Protocole</p>
              <p className="font-mono text-foreground">{props.protocol}</p>
            </div>
            <div className="rounded border border-border/80 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Bitrate</p>
              <p className="font-mono text-foreground">{props.bitrate}</p>
            </div>
            <div className="rounded border border-border/80 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Résolution/FPS</p>
              <p className="font-mono text-foreground">{props.resolution} @ {props.fps}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

