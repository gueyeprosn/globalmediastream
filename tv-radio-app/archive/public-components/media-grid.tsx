"use client"

import { Tv, Radio, Music, Mic } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const tvChannels = [
  { id: 1, name: "France 2", category: "Actualités", live: true, icon: Tv },
  { id: 2, name: "TF1", category: "Généraliste", live: true, icon: Tv },
  { id: 3, name: "M6", category: "Divertissement", live: false, icon: Tv },
  { id: 4, name: "Arte", category: "Culture", live: true, icon: Tv },
]

const radioStations = [
  { id: 5, name: "RTL", category: "Actualités", live: true, icon: Radio },
  { id: 6, name: "NRJ", category: "Musique", live: true, icon: Music },
  { id: 7, name: "France Inter", category: "Talk", live: true, icon: Mic },
  { id: 8, name: "Skyrock", category: "Jeunes", live: false, icon: Radio },
]

export function MediaGrid() {
  return (
    <section className="container px-4 py-16">
      <div className="space-y-12">
        {/* TV Section */}
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Chaînes TV</h2>
              <p className="text-muted-foreground mt-1">Regardez vos chaînes préférées en direct</p>
            </div>
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
              En direct
            </Badge>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {tvChannels.map((channel) => (
              <Card
                key={channel.id}
                className="group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary">
                      <channel.icon className="h-8 w-8 text-primary transition-colors group-hover:text-primary-foreground" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg">{channel.name}</h3>
                      <p className="text-sm text-muted-foreground">{channel.category}</p>
                    </div>
                    {channel.live && (
                      <Badge variant="destructive" className="bg-accent text-accent-foreground">
                        <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-accent-foreground" />
                        EN DIRECT
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Radio Section */}
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Stations Radio</h2>
              <p className="text-muted-foreground mt-1">Écoutez la radio partout, tout le temps</p>
            </div>
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
              + 1000 stations
            </Badge>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {radioStations.map((station) => (
              <Card
                key={station.id}
                className="group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-secondary/20 transition-colors group-hover:bg-secondary">
                      <station.icon className="h-8 w-8 text-secondary transition-colors group-hover:text-secondary-foreground" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg">{station.name}</h3>
                      <p className="text-sm text-muted-foreground">{station.category}</p>
                    </div>
                    {station.live && (
                      <Badge variant="destructive" className="bg-accent text-accent-foreground">
                        <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-accent-foreground" />
                        EN DIRECT
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
