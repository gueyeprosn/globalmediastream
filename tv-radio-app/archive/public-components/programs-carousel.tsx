"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Clock } from "lucide-react"

const programs = [
  {
    id: 1,
    title: "Khassaïdes du Matin",
    time: "06:00 - 08:00",
    type: "Radio",
    description: "Récitation et explication des khassaïdes de Cheikh Ahmadou Bamba",
    image: "/islamic-calligraphy-book.jpg",
  },
  {
    id: 2,
    title: "Journal Télévisé",
    time: "13:00 - 14:00",
    type: "TV",
    description: "L'actualité nationale et internationale",
    image: "/tv-news-studio-senegal.jpg",
  },
  {
    id: 3,
    title: "Débat Religieux",
    time: "15:00 - 17:00",
    type: "TV",
    description: "Discussions sur l'Islam et la spiritualité mouride",
    image: "/islamic-discussion-panel.jpg",
  },
  {
    id: 4,
    title: "Musique Traditionnelle",
    time: "18:00 - 20:00",
    type: "Radio",
    description: "Les meilleurs chants religieux et traditionnels",
    image: "/traditional-senegalese-music.jpg",
  },
  {
    id: 5,
    title: "Magal en Direct",
    time: "20:00 - 23:00",
    type: "TV",
    description: "Couverture spéciale des événements religieux",
    image: "/grand-magal-touba.jpg",
  },
]

export function ProgramsCarousel() {
  return (
    <section className="py-16 px-4">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Nos Programmes</h2>
            <p className="text-muted-foreground mt-2">Découvrez notre programmation variée</p>
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {programs.map((program) => (
            <Card key={program.id} className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow">
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={program.image || "/placeholder.svg"}
                  alt={program.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      program.type === "TV" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                    }`}
                  >
                    {program.type}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {program.time}
                  </div>
                </div>
                <h3 className="font-bold text-balance">{program.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 text-pretty">{program.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
