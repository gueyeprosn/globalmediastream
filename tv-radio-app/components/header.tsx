"use client"

import { Radio, Tv, Search, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
              <Radio className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Tv className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-sm font-bold text-foreground">Ocean FM & Touba TV</span>
            <span className="text-xs text-muted-foreground">Groupe de Presse Mouride</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Button 
            variant="ghost"
            onClick={(e) => {
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            Accueil
          </Button>
          <Button 
            variant="ghost" 
            className="gap-2"
            onClick={(e) => {
              e.preventDefault()
              const playerSection = document.querySelector('[data-player-section]')
              if (playerSection) {
                playerSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
          >
            <Tv className="h-4 w-4" />
            Touba TV
          </Button>
          <Button 
            variant="ghost" 
            className="gap-2"
            onClick={(e) => {
              e.preventDefault()
              const playerSection = document.querySelector('[data-player-section]')
              if (playerSection) {
                playerSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
          >
            <Radio className="h-4 w-4" />
            Ocean FM
          </Button>
          <Button 
            variant="ghost"
            onClick={(e) => {
              e.preventDefault()
              const programsSection = document.querySelector('[data-programs-section]')
              if (programsSection) {
                programsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
          >
            Programmes
          </Button>
          <Button 
            variant="ghost"
            onClick={(e) => {
              e.preventDefault()
              const offersSection = document.querySelector('[data-offers-section]')
              if (offersSection) {
                offersSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
          >
            Offres
          </Button>
          <Button 
            variant="ghost"
            onClick={(e) => {
              e.preventDefault()
              const footer = document.querySelector('footer')
              if (footer) {
                footer.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
          >
            Contact
          </Button>
          <Button variant="ghost" asChild>
            <a href="/admin">Admin</a>
          </Button>
        </nav>

        <div className="flex items-center gap-2">
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" placeholder="Rechercher..." className="w-64 pl-9" />
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur">
          <div className="container px-4 py-4 space-y-2">
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={(e) => {
                e.preventDefault()
                setMobileMenuOpen(false)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              Accueil
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2"
              onClick={(e) => {
                e.preventDefault()
                setMobileMenuOpen(false)
                const playerSection = document.querySelector('[data-player-section]')
                if (playerSection) {
                  playerSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}
            >
              <Tv className="h-4 w-4" />
              Touba TV
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2"
              onClick={(e) => {
                e.preventDefault()
                setMobileMenuOpen(false)
                const playerSection = document.querySelector('[data-player-section]')
                if (playerSection) {
                  playerSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}
            >
              <Radio className="h-4 w-4" />
              Ocean FM
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={(e) => {
                e.preventDefault()
                setMobileMenuOpen(false)
                const programsSection = document.querySelector('[data-programs-section]')
                if (programsSection) {
                  programsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}
            >
              Programmes
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={(e) => {
                e.preventDefault()
                setMobileMenuOpen(false)
                const offersSection = document.querySelector('[data-offers-section]')
                if (offersSection) {
                  offersSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}
            >
              Offres
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={(e) => {
                e.preventDefault()
                setMobileMenuOpen(false)
                const footer = document.querySelector('footer')
                if (footer) {
                  footer.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}
            >
              Contact
            </Button>
            <Button variant="ghost" className="w-full justify-start" asChild>
              <a href="/admin">Admin</a>
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
