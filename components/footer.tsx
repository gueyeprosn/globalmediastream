"use client"

import { Radio, Tv, Mail, Phone, MapPin } from "lucide-react"
import { SiFacebook, SiX, SiInstagram, SiYoutube } from "@icons-pack/react-simple-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container px-4 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Ocean FM */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                <Radio className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-bold">Ocean FM 98.7</h3>
                <p className="text-xs text-primary-foreground/80">La fréquence de votre écoute</p>
              </div>
            </div>
            <p className="text-sm text-primary-foreground/90 text-pretty leading-relaxed">
              Votre radio de référence pour l'information, la spiritualité et la culture mouride au Sénégal.
            </p>
          </div>

          {/* Touba TV */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                <Tv className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <h3 className="font-bold">Touba TV</h3>
                <p className="text-xs text-primary-foreground/80">La télévision qui nous rassemble</p>
              </div>
            </div>
            <p className="text-sm text-primary-foreground/90 text-pretty leading-relaxed">
              Votre chaîne de télévision dédiée à la promotion des valeurs de la confrérie Mouride.
            </p>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Contact</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Touba, Sénégal</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <span>+221 33 XXX XX XX</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <span>contact@oceanfm-toubatv.sn</span>
              </div>
            </div>
          </div>

          {/* Newsletter */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Newsletter</h3>
            <p className="text-sm text-primary-foreground/90">Restez informé de notre actualité</p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Votre email"
                className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
              />
              <Button 
                type="button"
                variant="secondary"
                onClick={(e) => {
                  e.preventDefault()
                  console.log('Newsletter subscription')
                }}
              >
                OK
              </Button>
            </div>
          </div>
        </div>

        {/* Social & Copyright */}
        <div className="pt-8 border-t border-primary-foreground/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-primary-foreground/80">© 2025 Ocean FM & Touba TV. Tous droits réservés.</p>
            <div className="flex items-center gap-2">
              <Button 
                type="button"
                size="icon" 
                variant="ghost" 
                className="h-9 w-9 hover:bg-primary-foreground/10"
                onClick={() => window.open('https://facebook.com', '_blank')}
              >
                <SiFacebook className="h-4 w-4" />
              </Button>
              <Button 
                type="button"
                size="icon" 
                variant="ghost" 
                className="h-9 w-9 hover:bg-primary-foreground/10"
                onClick={() => window.open('https://twitter.com', '_blank')}
              >
                <SiX className="h-4 w-4" />
              </Button>
              <Button 
                type="button"
                size="icon" 
                variant="ghost" 
                className="h-9 w-9 hover:bg-primary-foreground/10"
                onClick={() => window.open('https://instagram.com', '_blank')}
              >
                <SiInstagram className="h-4 w-4" />
              </Button>
              <Button 
                type="button"
                size="icon" 
                variant="ghost" 
                className="h-9 w-9 hover:bg-primary-foreground/10"
                onClick={() => window.open('https://youtube.com', '_blank')}
              >
                <SiYoutube className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
