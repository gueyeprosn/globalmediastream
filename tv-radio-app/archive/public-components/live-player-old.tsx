"use client"

import { useState } from "react"
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

const stations: Station[] = [
  {
    id: "radio",
    name: "Ocean FM 98.7",
    slug: "ocean-fm",
    type: "radio",
    stream: "https://stream.example.com/ocean-fm/icecast",
    tagline: "La fréquence de votre écoute",
    nowPlaying: {
      title: "Khassaïdes du Matin",
      artist: "Serigne Modou Fall",
      cover: "/islamic-calligraphy-book.jpg",
    },
    listeners: 1320,
    format: "AAC • 128kbps",
  },
  {
    id: "tv",
    name: "Touba TV",
    slug: "touba-tv",
    type: "tv",
    stream: "https://stream.example.com/touba-tv/hls.m3u8",
    tagline: "La télévision qui nous rassemble",
    nowPlaying: {
      title: "Journal Télévisé",
      artist: "Équipe Rédaction",
      cover: "/tv-news-studio-senegal.jpg",
    },
    listeners: 2680,
    format: "HLS • 720p",
  },
]

export function LivePlayer() {
  const [activeStation, setActiveStation] = useState<Station>(stations[0])
  const [isPlaying, setIsPlaying] = useState(true)
  const [volume, setVolume] = useState<number>(70)

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
                    <span className="truncate max-w-[200px] text-primary font-medium">{activeStation.stream}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Button
                      size="lg"
                      className="flex-1 gap-2"
                      onClick={() => setIsPlaying((prev) => !prev)}
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
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">Icecast / HLS</Badge>
                    <Badge variant="outline">Radio.co ready</Badge>
                    <Badge variant="outline">Shoutcast ready</Badge>
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
                  onClick={() => {
                    setActiveStation(station)
                    setIsPlaying(true)
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
    </section>
  )
}
