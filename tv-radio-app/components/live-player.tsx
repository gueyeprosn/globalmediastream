"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Pause, Play, Radio, Signal, Tv, Volume2, VolumeX } from "lucide-react"
import Hls from "hls.js"

type Station = {
  id: "radio" | "tv"
  name: string
  slug: string
  type: "radio" | "tv"
  stream: string
  tagline: string
  nowPlaying: {
    title: string
    artist: string
    cover: string
  }
  listeners: number
  format: string
}

const STREAM_URL = "https://stream.broadcastsn.com/oceanfm"
const TOUBATV_URL = "https://stream.broadcastsn.com/toubatv/index.m3u8"
const appendCacheBuster = (url: string) => {
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}_ts=${Date.now()}`
}

const stations: Station[] = [
  {
    id: "radio",
    name: "Ocean FM 98.7",
    slug: "ocean-fm",
    type: "radio",
    stream: STREAM_URL,
    tagline: "La fréquence de votre écoute",
    nowPlaying: {
      title: "Streaming Direct",
      artist: "Ocean FM 98.7",
      cover: "/oceanfm-logo-white.png",
    },
    listeners: 1200,
    format: "MP3 • 128kbps",
  },
  {
    id: "tv",
    name: "Touba TV",
    slug: "touba-tv",
    type: "tv",
    stream: TOUBATV_URL,
    tagline: "La télévision qui nous rassemble",
    nowPlaying: {
      title: "En Direct",
      artist: "Touba TV",
      cover: "/logo-toubatv.png",
    },
    listeners: 2680,
    format: "HLS • 720p",
  },
]

export function LivePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [activeStation, setActiveStation] = useState<Station>(stations[0])
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState<number>(70)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isMuted, setIsMuted] = useState(true) // Démarrer en mode mute

  // Détection mobile et autoplay
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
      setIsMobile(isMobileDevice)
    }
    checkMobile()
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    const video = videoRef.current
    if (audio) {
      audio.volume = isMuted ? 0 : volume / 100
      audio.muted = isMuted
      audio.setAttribute('playsinline', 'true')
      audio.setAttribute('preload', 'auto')
    }
    if (video) {
      video.volume = isMuted ? 0 : volume / 100
      video.muted = isMuted
    }
  }, [volume, isMuted])

  // Gestion du stream HLS pour Touba TV
  useEffect(() => {
    if (activeStation.type !== "tv" || !videoRef.current) return

    const video = videoRef.current
    const streamUrl = activeStation.stream

    // Vérifier si le navigateur supporte HLS nativement (Safari)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = appendCacheBuster(streamUrl)
      return
    }

    // Utiliser hls.js pour les autres navigateurs
    if (Hls.isSupported()) {
      const BaseLoader = Hls.DefaultConfig.loader
      class NoCachePlaylistLoader extends BaseLoader {
        load(context: any, config: any, callbacks: any) {
          const isPlaylist = typeof context?.url === "string" && context.url.includes(".m3u8")
          const nextContext = isPlaylist
            ? { ...context, url: appendCacheBuster(context.url) }
            : context
          // Evite les playlists figées si un cache intermédiaire répond trop vieux.
          super.load(nextContext, config, callbacks)
        }
      }

      const hls = new Hls({
        loader: NoCachePlaylistLoader as any,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        // Profil stable: environ 30 secondes de buffer live.
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        liveSyncDuration: 30,
        liveMaxLatencyDuration: 60,
      })

      hls.loadSource(streamUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('Stream HLS chargé avec succès')
        setError(null)
        // Démarrer en mode mute
        video.muted = true
        video.volume = 0
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        // Ne logger que les erreurs fatales ou importantes
        if (data.fatal) {
          console.error('Erreur HLS fatale:', data)
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError("Erreur réseau. Vérifiez votre connexion.")
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError("Erreur de lecture vidéo. Tentative de récupération...")
              hls.recoverMediaError()
              break
            default:
              setError("Erreur de lecture. Rechargement du stream...")
              hls.destroy()
              hls.loadSource(streamUrl)
              hls.attachMedia(video)
              break
          }
        } else {
          // Erreurs non fatales : ne pas afficher dans la console
          // (ex: buffer underrun, décalage de timing, etc.)
        }
      })

      hlsRef.current = hls

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy()
          hlsRef.current = null
        }
      }
    } else {
      setError("Votre navigateur ne supporte pas la lecture HLS.")
    }
  }, [activeStation])

  // Pas d'autoplay automatique - l'utilisateur doit cliquer sur le bouton de lecture

  const togglePlay = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (activeStation.type === "tv") {
      // Pour Touba TV, utiliser le lecteur vidéo HLS
      const video = videoRef.current
      if (!video) {
        setError("Lecteur vidéo non disponible.")
        return
      }

      try {
        if (isPlaying) {
          video.pause()
          setIsPlaying(false)
        } else {
          // Démarrer en mode mute
          video.muted = true
          video.volume = 0
          await video.play()
          setIsPlaying(true)
          setError(null)
        }
      } catch (err) {
        console.error('Erreur de lecture vidéo:', err)
        setError("Lecture impossible pour le moment.")
        setIsPlaying(false)
      }
      return
    }

    const audio = audioRef.current
    if (!audio) {
      setError("Lecteur audio non disponible.")
      return
    }

    try {
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
      } else {
        // S'assurer que la source est à jour
        if (audio.src !== activeStation.stream) {
          audio.src = activeStation.stream
        }
        await audio.play()
        setIsPlaying(true)
        setError(null)
      }
    } catch (err) {
      console.error('Erreur de lecture:', err)
      setError("Lecture impossible pour le moment.")
      setIsPlaying(false)
    }
  }

  const handleStationChange = (station: Station) => {
    // Arrêter la lecture actuelle
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
    
    // Détruire l'instance HLS précédente si elle existe
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    
    setActiveStation(station)
    setIsPlaying(false)
    setError(null)
    
    // Mettre à jour la source audio si c'est une radio
    if (station.type === "radio" && audioRef.current) {
      audioRef.current.src = station.stream
      audioRef.current.muted = true
      audioRef.current.volume = 0
      // Ne pas jouer automatiquement, attendre l'action de l'utilisateur
    }
    // Pour la TV, s'assurer que la vidéo est en mode mute
    if (station.type === "tv" && videoRef.current) {
      videoRef.current.muted = true
      videoRef.current.volume = 0
    }
  }

  return (
    <section className="py-12 px-4 bg-muted/30" data-player-section>
      <div className="container">
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
          <Card className="p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`h-12 w-12 rounded-full flex items-center justify-center ${
                    activeStation.type === "tv" ? "bg-primary" : "bg-accent"
                  }`}
                >
                  {activeStation.type === "tv" ? (
                    <Tv className="h-6 w-6 text-primary-foreground" />
                  ) : (
                    <Radio className="h-6 w-6 text-accent-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{activeStation.name}</h3>
                  <p className="text-sm text-muted-foreground">{activeStation.tagline}</p>
                </div>
              </div>
              <Badge variant="secondary" className="gap-1">
                <Signal className="h-3 w-3" />
                EN DIRECT
              </Badge>
            </div>

            <div className="grid md:grid-cols-[1.2fr_1fr] gap-4">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-primary/5">
                {activeStation.type === "tv" ? (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted={true}
                      controls={false}
                    />
                    {!isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="text-center text-primary-foreground">
                          <p className="text-xs uppercase tracking-wide opacity-80 mb-2">En Direct</p>
                          <h4 className="text-xl font-semibold leading-tight">{activeStation.nowPlaying.title}</h4>
                          <p className="text-sm opacity-90">{activeStation.nowPlaying.artist}</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Image
                      src={activeStation.nowPlaying.cover}
                      alt={activeStation.nowPlaying.title}
                      fill
                      className="object-cover"
                      sizes="100vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 text-primary-foreground">
                      <p className="text-xs uppercase tracking-wide opacity-80">Now Playing</p>
                      <h4 className="text-xl font-semibold leading-tight">{activeStation.nowPlaying.title}</h4>
                      <p className="text-sm opacity-90">{activeStation.nowPlaying.artist}</p>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Flux</span>
                    <Badge variant="outline">{activeStation.format}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Auditeurs</span>
                    <span className="font-semibold">{activeStation.listeners.toLocaleString("fr-FR")}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">URL stream</span>
                    <span className="truncate max-w-[200px] text-primary font-medium text-xs">{activeStation.stream}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      size="lg"
                      className="flex-1 gap-2"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        togglePlay()
                      }}
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      {isPlaying ? "Pause" : "Lire"}
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsMuted(!isMuted)
                          if (isMuted && volume === 0) {
                            setVolume(70)
                          }
                        }}
                        className="h-10 w-10 p-0"
                      >
                        {isMuted ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                      <div className="w-32">
                        <Slider
                          value={[isMuted ? 0 : volume]}
                          max={100}
                          step={1}
                          onValueChange={(val) => {
                            const newVolume = val[0]
                            setVolume(newVolume)
                            if (newVolume > 0) {
                              setIsMuted(false)
                            }
                          }}
                          aria-label="Volume"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {isMuted ? 'Mute' : `${volume}%`}
                      </span>
                    </div>
                  </div>
                  {error && (
                    <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-xs text-destructive">{error}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">Icecast / HLS</Badge>
                    {activeStation.type === "radio" && (
                      <a
                        href="/oceanfm.m3u"
                        download="oceanfm.m3u"
                        className="inline-flex items-center px-2 py-1 rounded border border-border hover:bg-accent"
                      >
                        📥 .m3u
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Stations</h3>
              <Badge variant="outline">Sélection</Badge>
            </div>
            <div className="space-y-3">
              {stations.map((station) => (
                <button
                  key={station.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleStationChange(station)
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    activeStation.id === station.id ? "border-primary bg-primary/10" : "hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        station.type === "tv" ? "bg-primary/10" : "bg-accent/10"
                      }`}
                    >
                      {station.type === "tv" ? (
                        <Tv className="h-5 w-5 text-primary" />
                      ) : (
                        <Radio className="h-5 w-5 text-accent" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold leading-tight">{station.name}</p>
                      <p className="text-xs text-muted-foreground">{station.tagline}</p>
                    </div>
                    <Badge variant="secondary" className="uppercase">
                      {station.type}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground line-clamp-1">
                    {station.nowPlaying.title} • {station.nowPlaying.artist}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
      {activeStation.type === "radio" && (
        <audio 
          ref={audioRef} 
          src={activeStation.stream} 
          preload="auto"
          playsInline
        />
      )}
    </section>
  )
}
