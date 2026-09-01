"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, ArrowRight } from "lucide-react"

const news = [
  {
    id: 1,
    title: "Grand Magal de Touba 2024 - Couverture Spéciale",
    excerpt: "Notre équipe sera mobilisée pour vous faire vivre le Grand Magal en direct sur Touba TV et Ocean FM",
    date: "15 Mars 2024",
    category: "Événement",
    image: "/grand-magal-touba.jpg",
  },
  {
    id: 2,
    title: "Nouvelle grille de programmes pour la rentrée",
    excerpt: "Découvrez nos nouvelles émissions et programmes pour cette nouvelle saison",
    date: "10 Mars 2024",
    category: "Actualité",
    image: "/tv-news-studio-senegal.jpg",
  },
  {
    id: 3,
    title: "Interview exclusive avec Serigne Mountakha Mbacké",
    excerpt: "Ne manquez pas cette interview exceptionnelle ce vendredi à 15h sur Touba TV",
    date: "8 Mars 2024",
    category: "Spiritualité",
    image: "/islamic-mosque-touba-senegal.jpg",
  },
]

export function NewsSection() {
  return (
    <section className="py-16 px-4 bg-background">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Actualités</h2>
            <p className="text-muted-foreground mt-2">Les dernières nouvelles de nos médias</p>
          </div>
          <Button variant="ghost" className="gap-2">
            Voir tout
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {news.map((article) => (
            <Card key={article.id} className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow">
              <div className="aspect-video overflow-hidden">
                <img
                  src={article.image || "/placeholder.svg"}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-6 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="px-2 py-1 rounded bg-primary/10 text-primary font-medium">{article.category}</span>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {article.date}
                  </div>
                </div>
                <h3 className="font-bold text-lg text-balance leading-tight">{article.title}</h3>
                <p className="text-muted-foreground text-sm text-pretty leading-relaxed">{article.excerpt}</p>
                <Button variant="link" className="px-0 gap-1">
                  Lire la suite
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
