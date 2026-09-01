"use client"

import { useState } from "react"
import { Play, Pause, SkipBack, SkipForward, Volume2, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

export function Player() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState([50])

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90">
      <div className="container px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Now Playing Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-primary/20 flex items-center justify-center">
              <Play className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">France 2 - Journal 20h</p>
              <p className="text-sm text-muted-foreground truncate">Actualités - En direct</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              className="h-10 w-10 bg-accent hover:bg-accent/90"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 text-accent-foreground" />
              ) : (
                <Play className="h-5 w-5 text-accent-foreground" />
              )}
            </Button>
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>

          {/* Volume & Fullscreen */}
          <div className="hidden md:flex items-center gap-3 flex-1 justify-end">
            <Volume2 className="h-5 w-5 text-muted-foreground" />
            <Slider value={volume} onValueChange={setVolume} max={100} step={1} className="w-24" />
            <Button variant="ghost" size="icon">
              <Maximize2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
