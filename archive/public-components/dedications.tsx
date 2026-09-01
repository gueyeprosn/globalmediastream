"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageCircle, Send } from "lucide-react"

const recentMessages = [
  {
    id: 1,
    name: "Awa",
    city: "Dakar",
    message: "Dédicace à toute ma famille à Touba, merci pour vos émissions inspirantes.",
    time: "Il y a 12 min",
  },
  {
    id: 2,
    name: "Moussa",
    city: "Diourbel",
    message: "Force à l'équipe Ocean FM, je vous écoute chaque matin sur la route.",
    time: "Il y a 35 min",
  },
  {
    id: 3,
    name: "Fatou",
    city: "Paris",
    message: "Salam depuis la diaspora, merci pour la connexion HLS qui marche nickel.",
    time: "Il y a 1 h",
  },
]

export function Dedications() {
  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [message, setMessage] = useState("")

  return (
    <section className="py-16 px-4">
      <div className="container">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Dédicaces & Messages</h2>
            <p className="text-muted-foreground">
              Envoyez vos messages à l'antenne. Les messages passent en modération avant diffusion.
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <MessageCircle className="h-4 w-4" />
            Modération active
          </Badge>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6">
          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Votre nom" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Ville / Pays" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <Textarea
              placeholder="Votre message à diffuser..."
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <Button className="gap-2" disabled={!message}>
              <Send className="h-4 w-4" />
              Envoyer pour modération
            </Button>
            <p className="text-xs text-muted-foreground">
              Les messages offensants ou publicitaires sont filtrés automatiquement avant diffusion.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Messages récents</h3>
              <Badge variant="secondary">En attente</Badge>
            </div>
            <div className="space-y-4">
              {recentMessages.map((item) => (
                <div key={item.id} className="flex gap-3 p-3 rounded-lg border hover:border-primary/40 transition-colors">
                  <Avatar>
                    <AvatarImage src={`/placeholder-user.jpg`} alt={item.name} />
                    <AvatarFallback>{item.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{item.name}</p>
                      <span className="text-xs text-muted-foreground">{item.city}</span>
                      <Badge variant="outline" className="text-[11px]">
                        {item.time}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
