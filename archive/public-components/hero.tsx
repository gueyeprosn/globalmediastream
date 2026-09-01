"use client"

import { Button } from "@/components/ui/button"
import { Play, Radio, Tv } from "lucide-react"

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-secondary px-4 py-20 md:py-28 text-primary-foreground">
      <div className="container relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="flex items-center justify-center gap-8 mb-6">
            <div className="text-center space-y-2">
              <div className="h-20 w-20 mx-auto rounded-full bg-accent/20 backdrop-blur-sm flex items-center justify-center border-2 border-accent">
                <Radio className="h-10 w-10 text-accent-foreground" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Ocean FM 98.7</h3>
                <p className="text-sm text-primary-foreground/80">La fréquence de votre écoute</p>
              </div>
            </div>
            <div className="h-16 w-px bg-primary-foreground/20" />
            <div className="text-center space-y-2">
              <div className="h-20 w-20 mx-auto rounded-full bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center border-2 border-primary-foreground">
                <Tv className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Touba TV</h3>
                <p className="text-sm text-primary-foreground/80">La télévision qui nous rassemble</p>
              </div>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-balance">
            Groupe de Presse Mouride du Sénégal
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/90 text-pretty leading-relaxed max-w-3xl mx-auto">
            Vos médias de référence de la confrérie Mouride. Information, spiritualité, culture et valeurs islamiques en
            direct depuis Touba.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button 
              size="lg" 
              variant="secondary" 
              className="gap-2 h-12 px-8"
              onClick={(e) => {
                e.preventDefault()
                const playerSection = document.querySelector('[data-player-section]')
                if (playerSection) {
                  playerSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}
            >
              <Play className="h-5 w-5" />
              Écouter en direct
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20 h-12 px-8"
              onClick={(e) => {
                e.preventDefault()
                const programsSection = document.querySelector('[data-programs-section]')
                if (programsSection) {
                  programsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}
            >
              Découvrir nos programmes
            </Button>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-accent blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-secondary blur-3xl" />
      </div>
    </section>
  )
}
