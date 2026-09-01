"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Pause, Play, Radio, Signal, Tv, Volume2 } from "lucide-react"

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
      cover: "/tv-news-studio-senegal.jpg",
    },
    listeners: 2680,
    format: "HLS • 720p",
  },
]

export function LivePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [activeStation, setActiveStation] = useState<Station>(stations[0])
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState<number>(70)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

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
    if (audio) {
      audio.volume = volume / 100
      audio.setAttribute('playsinline', 'true')
      audio.setAttribute('preload', 'auto')
    }
  }, [volume])

  // Autoplay sur mobile - nécessite une interaction utilisateur
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || activeStation.type === "tv") return

    const enableAutoplay = async () => {
      try {
        await audio.play()
        setIsPlaying(true)
        setError(null)
      } catch (err) {
        console.log('Autoplay nécessite une interaction utilisateur')
      }
    }

    if (isMobile) {
      const handleFirstInteraction = async () => {
        await enableAutoplay()
        document.removeEventListener('click', handleFirstInteraction)
        document.removeEventListener('touchstart', handleFirstInteraction)
      }

      document.addEventListener('click', handleFirstInteraction, { once: true })
      document.addEventListener('touchstart', handleFirstInteraction, { once: true })

      return () => {
        document.removeEventListener('click', handleFirstInteraction)
        document.removeEventListener('touchstart', handleFirstInteraction)
        audioRef.current?.pause()
      }
    } else {
      const timeout = setTimeout(enableAutoplay, 500)
      return () => {
        clearTimeout(timeout)
        audioRef.current?.pause()
      }
    }
  }, [isMobile, activeStation])

  const togglePlay = async () => {
    if (activeStation.type === "tv") {
      // Pour la TV, rediriger vers le stream HLS
      window.open(activeStation.stream, '_blank')
      return
    }

    const audio = audioRef.current
    if (!audio) return

    try {
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
      } else {
        await audio.play()
        setIsPlaying(true)
        setError(null)
      }
    } catch (err) {
      setError("Lecture impossible pour le moment.")
      setIsPlaying(false)
    }
  }

  const handleStationChange = (station: Station) => {
    setActiveStation(station)
    setIsPlaying(false)
    setError(null)
    if (audioRef.current) {
      audioRef.current.pause()
      if (station.type === "radio") {
        audioRef.current.src = station.stream
      }
    }
  }

  return (
    <section className="py-12 px-4 bg-muted/30">
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
                      size="lg"
                      className="flex-1 gap-2"
                      onClick={togglePlay}
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      {isPlaying ? "Pause" : "Lire"}
                    </Button>
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-5 w-5 text-muted-foreground" />
                      <div className="w-32">
                        <Slider
                          value={[volume]}
                          max={100}
                          step={1}
                          onValueChange={(val) => setVolume(val[0])}
                          aria-label="Volume"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">{volume}%</span>
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
                  onClick={() => handleStationChange(station)}
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
          crossOrigin="anonymous"
        />
      )}
    </section>
  )
}
