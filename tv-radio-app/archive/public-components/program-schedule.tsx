"use client"

import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, Radio, Tv } from "lucide-react"

const radioSchedule = [
  { time: "06:00", program: "Khassaïdes du Matin", host: "Serigne Modou Fall" },
  { time: "08:00", program: "Actualités du Jour", host: "Équipe Rédaction" },
  { time: "10:00", program: "Débat Citoyen", host: "Oustaz Mouhamadou" },
  { time: "12:00", program: "Journal de la Mi-journée", host: "Sokhna Aminata" },
  { time: "14:00", program: "Musique et Culture", host: "DJ Malick" },
  { time: "16:00", program: "Émission Interactive", host: "Cheikh Abdou" },
  { time: "18:00", program: "Prière du Soir", host: "Imam Mbaye" },
  { time: "20:00", program: "Soirée Musicale", host: "DJ Malick" },
  { time: "22:00", program: "Causerie Religieuse", host: "Serigne Modou Fall" },
]

const tvSchedule = [
  { time: "07:00", program: "Bonjour Touba TV", host: "Sokhna Fatou Bintou" },
  { time: "09:00", program: "Émission Jeunesse", host: "Pape Samba" },
  { time: "11:00", program: "Cuisine Traditionnelle", host: "Sokhna Aïda" },
  { time: "13:00", program: "Journal Télévisé", host: "Sokhna Fatou Bintou" },
  { time: "15:00", program: "Débat Religieux", host: "Cheikh Abdou Lahad" },
  { time: "17:00", program: "Reportage Spécial", host: "Équipe Reportage" },
  { time: "19:00", program: "Magazine Culturel", host: "Moussa Diop" },
  { time: "20:00", program: "Journal du Soir", host: "Sokhna Fatou Bintou" },
  { time: "21:00", program: "Documentaire Religieux", host: "Oustaz Mouhamadou" },
]

export function ProgramSchedule() {
  return (
    <section className="py-16 px-4">
      <div className="container">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Grille des Programmes</h2>
          <p className="text-muted-foreground mt-2">Consultez la programmation complète de nos médias</p>
        </div>

        <Tabs defaultValue="radio" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="radio" className="gap-2">
              <Radio className="h-4 w-4" />
              Ocean FM 98.7
            </TabsTrigger>
            <TabsTrigger value="tv" className="gap-2">
              <Tv className="h-4 w-4" />
              Touba TV
            </TabsTrigger>
          </TabsList>

          <TabsContent value="radio" className="mt-6">
            <Card className="p-6">
              <div className="space-y-4">
                {radioSchedule.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-accent font-semibold min-w-[80px]">
                      <Clock className="h-4 w-4" />
                      {item.time}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold">{item.program}</h4>
                      <p className="text-sm text-muted-foreground">{item.host}</p>
                    </div>
                    <Radio className="h-5 w-5 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="tv" className="mt-6">
            <Card className="p-6">
              <div className="space-y-4">
                {tvSchedule.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-primary font-semibold min-w-[80px]">
                      <Clock className="h-4 w-4" />
                      {item.time}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold">{item.program}</h4>
                      <p className="text-sm text-muted-foreground">{item.host}</p>
                    </div>
                    <Tv className="h-5 w-5 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
