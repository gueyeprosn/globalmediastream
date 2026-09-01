"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Play, Search, Volume2 } from "lucide-react"

const episodes = [
  {
    id: 1,
    title: "Histoire de la confrérie Mouride",
    category: "Documentaire",
    duration: "42:15",
    image: "/islamic-discussion-panel.jpg",
    description: "Un récit audio des moments clés de la confrérie.",
  },
  {
    id: 2,
    title: "Débat Religieux - Spécial Magal",
    category: "Débat",
    duration: "55:20",
    image: "/grand-magal-touba.jpg",
    description: "Spécial Magal avec Cheikh Abdou Lahad.",
  },
  {
    id: 3,
    title: "Journal du Soir",
    category: "Actualité",
    duration: "24:10",
    image: "/tv-news-studio-senegal.jpg",
    description: "L'essentiel de l'actualité du jour.",
  },
  {
    id: 4,
    title: "Khassaïdes : explications",
    category: "Spiritualité",
    duration: "33:05",
    image: "/islamic-calligraphy-book.jpg",
    description: "Analyse et récitations commentées.",
  },
]

const categories = ["Tous", "Actualité", "Débat", "Documentaire", "Spiritualité"]

export function Podcasts() {
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("Tous")

  const filtered = useMemo(() => {
    return episodes.filter((ep) => {
      const matchesCategory = activeCategory === "Tous" || ep.category === activeCategory
      const matchesQuery =
        ep.title.toLowerCase().includes(query.toLowerCase()) ||
        ep.description.toLowerCase().includes(query.toLowerCase())
      return matchesCategory && matchesQuery
    })
  }, [query, activeCategory])

  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="container space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Podcasts & Replay</h2>
            <p className="text-muted-foreground">Écoutez nos replays classés par catégorie.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un épisode..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="flex flex-wrap">
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat}>
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
          {categories.map((cat) => (
            <TabsContent key={cat} value={cat} className="mt-4">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {filtered.map((episode) => (
                  <Card key={episode.id} className="p-4 space-y-3 hover:shadow-lg transition-shadow">
                    <div className="aspect-[4/3] relative overflow-hidden rounded-lg">
                      <Image src={episode.image} alt={episode.title} fill className="object-cover" sizes="100vw" />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <Badge variant="outline">{episode.category}</Badge>
                      <span>{episode.duration}</span>
                    </div>
                    <h3 className="font-semibold leading-tight text-balance">{episode.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{episode.description}</p>
                    <div className="flex items-center justify-between">
                      <Button size="sm" className="gap-2">
                        <Play className="h-4 w-4" />
                        Écouter
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                        <Volume2 className="h-4 w-4" />
                        Partager
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
              {filtered.length === 0 && (
                <Card className="p-6 text-center text-muted-foreground">Aucun épisode trouvé pour cette recherche.</Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}
