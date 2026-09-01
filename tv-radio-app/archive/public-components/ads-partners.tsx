"use client"

import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Megaphone, Sparkles } from "lucide-react"

const spots = [
  {
    id: 1,
    title: "Pack Start FM",
    desc: "3 spots radio / jour en drive time + visibilité site & app",
    price: "25 000 FCFA",
    reach: "35 000 auditeurs/jour",
  },
  {
    id: 2,
    title: "Pack Impact TV",
    desc: "2 spots TV prime time + bannière site + post social",
    price: "75 000 FCFA",
    reach: "120 000 téléspectateurs/jour",
    featured: true,
  },
  {
    id: 3,
    title: "Pack Skyrock Style",
    desc: "Habillage antenne + billboard émission + interview studio",
    price: "150 000 FCFA",
    reach: "Audience mix radio + TV + digital",
  },
]

const partners = [
  { name: "Banque Islamique", logo: "/placeholder-logo.png" },
  { name: "Opérateur Mobile", logo: "/placeholder-logo.png" },
  { name: "Collectivité Touba", logo: "/placeholder-logo.png" },
  { name: "ONG Locale", logo: "/placeholder-logo.png" },
]

export function AdsPartners() {
  return (
    <section className="py-16 px-4 bg-background">
      <div className="container space-y-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Publicités & Partenaires</h2>
            <p className="text-muted-foreground">Packages inspirés des billboards antenne façon skyrock.fm.</p>
          </div>
          <Button size="lg" className="gap-2">
            <Megaphone className="h-5 w-5" />
            Demander un plan média
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {spots.map((spot) => (
            <Card
              key={spot.id}
              className={`p-6 space-y-4 relative ${spot.featured ? "border-primary shadow-lg" : ""}`}
            >
              {spot.featured && (
                <Badge className="absolute -top-3 right-4 gap-1">
                  <Sparkles className="h-4 w-4" />
                  Populaire
                </Badge>
              )}
              <h3 className="text-xl font-bold">{spot.title}</h3>
              <p className="text-sm text-muted-foreground">{spot.desc}</p>
              <div className="space-y-1">
                <p className="text-3xl font-bold text-primary">{spot.price}</p>
                <p className="text-sm text-muted-foreground">{spot.reach}</p>
              </div>
              <Button variant={spot.featured ? "default" : "outline"} className="w-full">
                Je réserve un spot
              </Button>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-bold">Nos partenaires</h3>
              <p className="text-muted-foreground">Merci à celles et ceux qui soutiennent la diffusion.</p>
            </div>
            <div className="flex flex-wrap gap-4">
              {partners.map((partner) => (
                <div
                  key={partner.name}
                  className="h-12 w-32 rounded-md bg-muted/60 border flex items-center justify-center px-3"
                >
                  <Image src={partner.logo} alt={partner.name} width={120} height={48} className="object-contain" />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}
