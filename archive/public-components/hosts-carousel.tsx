"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Radio, Tv } from "lucide-react"

const hosts = [
  {
    id: 1,
    name: "Serigne Modou Fall",
    role: "Animateur Principal",
    media: "Radio",
    program: "Khassaïdes du Matin",
    image: "/african-man-radio-host-professional.jpg",
  },
  {
    id: 2,
    name: "Sokhna Fatou Bintou",
    role: "Présentatrice JT",
    media: "TV",
    program: "Journal Télévisé",
    image: "/african-woman-tv-presenter-professional.jpg",
  },
  {
    id: 3,
    name: "Cheikh Abdou Lahad",
    role: "Animateur Religieux",
    media: "TV",
    program: "Débat Religieux",
    image: "/african-man-religious-scholar.jpg",
  },
  {
    id: 4,
    name: "Oustaz Mouhamadou",
    role: "Spécialiste Spirituel",
    media: "Radio",
    program: "Enseignement Religieux",
    image: "/african-man-islamic-teacher.jpg",
  },
]

export function HostsCarousel() {
  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Nos Présentateurs</h2>
            <p className="text-muted-foreground mt-2">Rencontrez l'équipe qui vous accompagne chaque jour</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {hosts.map((host) => (
            <Card key={host.id} className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow">
              <div className="aspect-square overflow-hidden">
                <img
                  src={host.image || "/placeholder.svg"}
                  alt={host.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  {host.media === "TV" ? (
                    <Tv className="h-4 w-4 text-primary" />
                  ) : (
                    <Radio className="h-4 w-4 text-accent" />
                  )}
                  <span className="text-xs font-semibold text-muted-foreground">{host.media}</span>
                </div>
                <h3 className="font-bold text-lg">{host.name}</h3>
                <p className="text-sm text-primary font-medium">{host.role}</p>
                <p className="text-sm text-muted-foreground">{host.program}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
