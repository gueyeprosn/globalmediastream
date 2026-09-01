"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, Radio, Tv, Briefcase } from "lucide-react"

const offers = [
  {
    id: 1,
    name: "Spot Radio",
    icon: Radio,
    price: "25 000 FCFA",
    duration: "30 secondes",
    features: [
      "Diffusion aux heures de pointe",
      "3 passages par jour",
      "Ciblage audience premium",
      "Rapport d'audience inclus",
    ],
  },
  {
    id: 2,
    name: "Spot TV",
    icon: Tv,
    price: "75 000 FCFA",
    duration: "30 secondes",
    features: [
      "Diffusion prime time",
      "2 passages par jour",
      "Production vidéo assistée",
      "Analyse d'impact détaillée",
    ],
    featured: true,
  },
  {
    id: 3,
    name: "Pack Premium",
    icon: Briefcase,
    price: "150 000 FCFA",
    duration: "Mensuel",
    features: [
      "5 spots radio + 3 spots TV",
      "Interview dans nos émissions",
      "Publication réseaux sociaux",
      "Reportage entreprise",
    ],
  },
]

export function CommercialOffers() {
  return (
    <section className="py-16 px-4 bg-muted/30" data-offers-section>
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">Nos Offres Commerciales</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto text-pretty">
            Donnez de la visibilité à votre entreprise avec nos solutions publicitaires adaptées à vos besoins
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {offers.map((offer) => {
            const Icon = offer.icon
            return (
              <Card
                key={offer.id}
                className={`p-6 space-y-6 ${
                  offer.featured ? "border-primary shadow-lg scale-105" : ""
                } hover:shadow-xl transition-all`}
              >
                {offer.featured && (
                  <div className="text-center -mt-10 mb-4">
                    <span className="px-4 py-1 rounded-full bg-accent text-accent-foreground text-xs font-semibold">
                      POPULAIRE
                    </span>
                  </div>
                )}

                <div className="text-center space-y-2">
                  <div
                    className={`h-16 w-16 mx-auto rounded-full flex items-center justify-center ${
                      offer.featured ? "bg-primary" : "bg-primary/10"
                    }`}
                  >
                    <Icon className={`h-8 w-8 ${offer.featured ? "text-primary-foreground" : "text-primary"}`} />
                  </div>
                  <h3 className="text-xl font-bold">{offer.name}</h3>
                  <div>
                    <p className="text-3xl font-bold text-primary">{offer.price}</p>
                    <p className="text-sm text-muted-foreground">{offer.duration}</p>
                  </div>
                </div>

                <ul className="space-y-3">
                  {offer.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  type="button"
                  className="w-full" 
                  variant={offer.featured ? "default" : "outline"}
                  onClick={(e) => {
                    e.preventDefault()
                    console.log('Demander un devis:', offer.name)
                  }}
                >
                  Demander un devis
                </Button>
              </Card>
            )
          })}
        </div>

        <div className="mt-12 text-center">
          <Card className="p-8 max-w-2xl mx-auto bg-primary text-primary-foreground">
            <h3 className="text-2xl font-bold mb-4">Offre Personnalisée</h3>
            <p className="mb-6 text-primary-foreground/90 text-pretty">
              Besoin d'une solution sur mesure ? Contactez notre équipe commerciale pour discuter de vos besoins
              spécifiques.
            </p>
            <Button 
              type="button"
              size="lg" 
              variant="secondary"
              onClick={(e) => {
                e.preventDefault()
                console.log('Contactez-nous')
              }}
            >
              Contactez-nous
            </Button>
          </Card>
        </div>
      </div>
    </section>
  )
}
