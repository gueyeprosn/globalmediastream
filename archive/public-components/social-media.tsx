"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Facebook, Youtube, Instagram, Twitter, ExternalLink } from "lucide-react"

const socialPosts = [
  {
    id: 1,
    platform: "Facebook",
    icon: Facebook,
    content: "🎙️ Nouvelle émission ce soir à 20h sur Ocean FM 98.7 ! Débat sur les valeurs mourides avec nos invités...",
    likes: "1.2K",
    time: "Il y a 2 heures",
    color: "bg-blue-500",
  },
  {
    id: 2,
    platform: "Instagram",
    icon: Instagram,
    content: "📺 En direct de Touba TV - Couverture spéciale du Magal #ToubaTv #Mouride",
    likes: "856",
    time: "Il y a 5 heures",
    color: "bg-pink-500",
  },
  {
    id: 3,
    platform: "Youtube",
    icon: Youtube,
    content: "🎬 Nouveau documentaire disponible : 'Histoire de la confrérie Mouride' - À regarder maintenant !",
    likes: "2.3K",
    time: "Il y a 1 jour",
    color: "bg-red-500",
  },
  {
    id: 4,
    platform: "Twitter",
    icon: Twitter,
    content: "✨ Ocean FM 98.7 - Votre rendez-vous quotidien pour l'information et la spiritualité #OceanFM",
    likes: "645",
    time: "Il y a 3 heures",
    color: "bg-sky-500",
  },
]

export function SocialMedia() {
  return (
    <section className="py-16 px-4">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">Suivez-nous sur les Réseaux Sociaux</h2>
          <p className="text-muted-foreground mt-2">Restez connectés avec Ocean FM 98.7 et Touba TV</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {socialPosts.map((post) => {
            const Icon = post.icon
            return (
              <Card key={post.id} className="p-6 space-y-4 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full ${post.color} flex items-center justify-center`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">{post.platform}</p>
                    <p className="text-xs text-muted-foreground">{post.time}</p>
                  </div>
                </div>

                <p className="text-sm text-pretty leading-relaxed">{post.content}</p>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-semibold text-muted-foreground">{post.likes} J'aime</span>
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm" 
                    className="gap-2"
                    onClick={(e) => {
                      e.preventDefault()
                      console.log('Voir post:', post.platform)
                    }}
                  >
                    Voir
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>

        <div className="flex justify-center gap-4 flex-wrap">
          <Button 
            type="button"
            variant="outline" 
            size="lg" 
            className="gap-2 bg-transparent"
            onClick={() => window.open('https://facebook.com', '_blank')}
          >
            <Facebook className="h-5 w-5 text-blue-500" />
            Facebook
          </Button>
          <Button 
            type="button"
            variant="outline" 
            size="lg" 
            className="gap-2 bg-transparent"
            onClick={() => window.open('https://instagram.com', '_blank')}
          >
            <Instagram className="h-5 w-5 text-pink-500" />
            Instagram
          </Button>
          <Button 
            type="button"
            variant="outline" 
            size="lg" 
            className="gap-2 bg-transparent"
            onClick={() => window.open('https://youtube.com', '_blank')}
          >
            <Youtube className="h-5 w-5 text-red-500" />
            Youtube
          </Button>
          <Button 
            type="button"
            variant="outline" 
            size="lg" 
            className="gap-2 bg-transparent"
            onClick={() => window.open('https://twitter.com', '_blank')}
          >
            <Twitter className="h-5 w-5 text-sky-500" />
            Twitter
          </Button>
        </div>
      </div>
    </section>
  )
}
