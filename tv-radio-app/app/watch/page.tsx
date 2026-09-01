"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Hls from "hls.js"
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

/** Flux autorisés pour /watch (QR / lien). Clé = param ?c= ou ?channel= */
const WATCH_CHANNELS: Record<string, { url: string; title: string }> = {
  toubatv: {
    url: "https://stream.broadcastsn.com/toubatv/index.m3u8",
    title: "Touba TV - En direct",
  },
  "external-tv": {
    url: "https://stream.broadcastsn.com/external-tv/index.m3u8",
    title: "External TV - En direct",
  },
  "external-tv-2": {
    url: "https://stream.broadcastsn.com/external-tv-2/index.m3u8",
    title: "External TV 2 - En direct",
  },
  "external-tv-3": {
    url: "https://stream.broadcastsn.com/external-tv-3/index.m3u8",
    title: "External TV 3 - En direct",
  },
}

const DEFAULT_CHANNEL = "toubatv"
const appendCacheBuster = (url: string) => {
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}_ts=${Date.now()}`
}

function WatchPageInner() {
  const searchParams = useSearchParams()
  const channelKey = (
    searchParams.get("c") ||
    searchParams.get("channel") ||
    DEFAULT_CHANNEL
  ).toLowerCase()
  const channel = WATCH_CHANNELS[channelKey] ?? WATCH_CHANNELS[DEFAULT_CHANNEL]
  const streamUrl = channel.url
  const pageTitle = channel.title

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Garde-fous pour éviter que video.play() soit interrompu par HLS
  const manifestParsedRef = useRef(false)
  const userWantsPlayRef = useRef(false)
  const playInFlightRef = useRef(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState<number>(100)
  const [isMuted, setIsMuted] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showControls, setShowControls] = useState(true)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Enregistrement du Service Worker pour PWA
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/watch-sw.js", { scope: "/watch/" })
        .catch((error) => {
          console.error("Erreur d'enregistrement du Service Worker:", error)
        })
    }
  }, [])

  // Initialisation HLS
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    manifestParsedRef.current = false
    userWantsPlayRef.current = false

    // Réinitialiser l'état
    setIsLoading(true)
    setError(null)

    if (Hls.isSupported()) {
      const BaseLoader = Hls.DefaultConfig.loader
      class NoCachePlaylistLoader extends BaseLoader {
        load(context: any, config: any, callbacks: any) {
          const isPlaylist = typeof context?.url === "string" && context.url.includes(".m3u8")
          const nextContext = isPlaylist
            ? { ...context, url: appendCacheBuster(context.url) }
            : context
          // Force la récupération fraîche des playlists pour éviter les gels intermittents.
          super.load(nextContext, config, callbacks)
        }
      }

      const hls = new Hls({
        loader: NoCachePlaylistLoader as any,
        enableWorker: true,
        lowLatencyMode: false,
        // Plus de buffer = lecture plus stable (au prix d'un retard plus élevé).
        backBufferLength: 120,
        maxBufferLength: 90,
        maxMaxBufferLength: 180,
        liveSyncDuration: 45,
        liveMaxLatencyDuration: 90,
        startLevel: -1,
        capLevelToPlayerSize: true,
      })

      hlsRef.current = hls

      hls.loadSource(streamUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        manifestParsedRef.current = true
        setIsLoading(false)
        video.muted = true
        setIsMuted(true)
        // Lecture uniquement si l'utilisateur l'a demandé.
        if (userWantsPlayRef.current) {
          userWantsPlayRef.current = false
          if (!playInFlightRef.current) {
            playInFlightRef.current = true
            video.play().catch((err) => {
              console.log("Lecture bloquée:", err)
              setError("Lecture impossible pour le moment.")
            }).finally(() => {
              playInFlightRef.current = false
            })
          }
        }
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setIsLoading(false)
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError("Erreur réseau. Tentative de reconnexion...")
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError("Erreur média. Tentative de récupération...")
              hls.recoverMediaError()
              break
            default:
              setError("Erreur fatale. Rechargement...")
              hls.destroy()
              setTimeout(() => {
                window.location.reload()
              }, 2000)
              break
          }
        }
      })

      hls.on(Hls.Events.FRAG_LOADED, () => {
        setError(null)
      })
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Support natif HLS (Safari)
      const ac = new AbortController()
      const { signal } = ac
      video.src = appendCacheBuster(streamUrl)
      video.addEventListener(
        "loadedmetadata",
        () => {
          manifestParsedRef.current = true
          setIsLoading(false)
          video.muted = true
          setIsMuted(true)
          if (userWantsPlayRef.current) {
            userWantsPlayRef.current = false
            if (!playInFlightRef.current) {
              playInFlightRef.current = true
              video.play().catch((err) => {
                console.log("Lecture bloquée:", err)
                setError("Lecture impossible pour le moment.")
              }).finally(() => {
                playInFlightRef.current = false
              })
            }
          }
        },
        { signal }
      )
      video.addEventListener(
        "error",
        () => {
          setError("Erreur de chargement du stream")
          setIsLoading(false)
        },
        { signal }
      )
      return () => {
        ac.abort()
        if (hlsRef.current) {
          hlsRef.current.destroy()
          hlsRef.current = null
        }
        video.pause()
        video.removeAttribute("src")
        video.load()
      }
    } else {
      setError("Votre navigateur ne supporte pas la lecture HLS")
      setIsLoading(false)
    }

    // Gestion du volume
    video.volume = volume / 100
    video.muted = isMuted

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      video.pause()
      video.removeAttribute("src")
      video.load()
    }
  }, [streamUrl])

  // Mise à jour du volume
  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.volume = isMuted ? 0 : volume / 100
      video.muted = isMuted
    }
  }, [volume, isMuted])

  // Gestion du fullscreen
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  // Masquer les contrôles après inactivité
  useEffect(() => {
    const resetControlsTimeout = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
      setShowControls(true)
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false)
        }
      }, 3000)
    }

    resetControlsTimeout()

    const container = containerRef.current
    if (container) {
      container.addEventListener("mousemove", resetControlsTimeout)
      container.addEventListener("touchstart", resetControlsTimeout)
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
      if (container) {
        container.removeEventListener("mousemove", resetControlsTimeout)
        container.removeEventListener("touchstart", resetControlsTimeout)
      }
    }
  }, [isPlaying])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      userWantsPlayRef.current = false
      video.pause()
    } else {
      setError(null)
      userWantsPlayRef.current = true
      // Toujours jouer en mute pour minimiser les blocages d'autoplay.
      video.muted = isMuted

      // Si le manifest est prêt, on déclenche tout de suite; sinon on attend.
      if (manifestParsedRef.current) {
        if (!playInFlightRef.current) {
          playInFlightRef.current = true
          video.play()
            .catch((err) => {
              console.log("Lecture bloquée:", err)
              setError("Lecture impossible pour le moment (autoplay bloqué ?).")
            })
            .finally(() => {
              playInFlightRef.current = false
            })
        }
      }
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const toggleFullscreen = () => {
    const container = containerRef.current
    if (!container) return

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => {
        console.error("Erreur fullscreen:", err)
      })
    } else {
      document.exitFullscreen()
    }
  }

  const handleVideoPlay = () => {
    setIsPlaying(true)
    setIsLoading(false)
  }

  const handleVideoPause = () => {
    setIsPlaying(false)
  }

  const handleVideoWaiting = () => {
    setIsLoading(true)
  }

  const handleVideoPlaying = () => {
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div
        ref={containerRef}
        className="relative w-full max-w-7xl aspect-video bg-black rounded-lg overflow-hidden group"
      >
        {/* Vidéo */}
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          onPlay={handleVideoPlay}
          onPause={handleVideoPause}
          onWaiting={handleVideoWaiting}
          onPlaying={handleVideoPlaying}
          onClick={togglePlay}
        />

        {/* Overlay de chargement */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-white animate-spin" />
              <p className="text-white text-sm">Chargement du stream...</p>
            </div>
          </div>
        )}

        {/* Message d'erreur */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
            <div className="text-center p-6 bg-red-900/50 rounded-lg border border-red-500">
              <p className="text-white font-semibold mb-2">Erreur</p>
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Contrôles */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="text-white hover:bg-white/20"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6" />
              )}
            </Button>

            {/* Volume */}
            <div className="flex items-center gap-2 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="text-white hover:bg-white/20"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </Button>
              <Slider
                value={[volume]}
                onValueChange={(value) => setVolume(value[0])}
                max={100}
                min={0}
                step={1}
                className="w-32"
              />
              <span className="text-white text-sm w-12 text-right">{volume}%</span>
            </div>

            {/* Fullscreen */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Titre en haut */}
        <div
          className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          <h1 className="text-white text-xl font-bold">{pageTitle}</h1>
        </div>
      </div>
    </div>
  )
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <Loader2 className="w-12 h-12 text-white animate-spin" />
        </div>
      }
    >
      <WatchPageInner />
    </Suspense>
  )
}
