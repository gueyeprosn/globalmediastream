"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Clock, Radio, Tv } from "lucide-react"

const weeklyGrid = {
  lundi: [
    { time: "06:00", title: "Khassaïdes du Matin", host: "Serigne Modou Fall", media: "radio" },
    { time: "09:00", title: "Bonjour Touba TV", host: "Sokhna Fatou Bintou", media: "tv" },
    { time: "13:00", title: "Journal Télévisé", host: "Équipe Rédaction", media: "tv" },
    { time: "18:00", title: "Prière du Soir", host: "Imam Mbaye", media: "radio" },
    { time: "21:00", title: "Documentaire Religieux", host: "Oustaz Mouhamadou", media: "tv" },
  ],
  mardi: [
    { time: "06:00", title: "Dhikr & Invocations", host: "Serigne Modou Fall", media: "radio" },
    { time: "10:00", title: "Débat Citoyen", host: "Oustaz Mouhamadou", media: "radio" },
    { time: "14:00", title: "Magazine Culturel", host: "Moussa Diop", media: "tv" },
    { time: "20:00", title: "Soirée Musicale", host: "DJ Malick", media: "radio" },
    { time: "22:00", title: "Causerie Religieuse", host: "Cheikh Abdou", media: "tv" },
  ],
  mercredi: [
    { time: "07:00", title: "Bonjour Touba TV", host: "Sokhna Fatou Bintou", media: "tv" },
    { time: "11:00", title: "Cuisine Traditionnelle", host: "Sokhna Aïda", media: "tv" },
    { time: "15:00", title: "Débat Religieux", host: "Cheikh Abdou Lahad", media: "tv" },
    { time: "18:00", title: "Prière du Soir", host: "Imam Mbaye", media: "radio" },
    { time: "21:00", title: "Musique Traditionnelle", host: "DJ Malick", media: "radio" },
  ],
}

const dayOrder = ["lundi", "mardi", "mercredi"]

export function ProgramGrid() {
  const [activeDay, setActiveDay] = useState<string>(dayOrder[0])

  return (
    <section className="py-16 px-4" data-programs-section>
      <div className="container">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Grille des Programmes</h2>
            <p className="text-muted-foreground">Vue rapide par jour et par média.</p>
          </div>
          <Tabs value={activeDay} onValueChange={setActiveDay} className="w-full md:w-auto">
            <TabsList className="grid grid-cols-3 md:grid-cols-3">
              {dayOrder.map((day) => (
                <TabsTrigger key={day} value={day} className="capitalize">
                  {day}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <Tabs value={activeDay} onValueChange={setActiveDay} className="w-full">
          <TabsContent value={activeDay}>
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Heure</TableHead>
                    <TableHead>Émission</TableHead>
                    <TableHead>Présentateur</TableHead>
                    <TableHead className="w-[120px]">Média</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyGrid[activeDay as keyof typeof weeklyGrid]?.map((slot) => (
                    <TableRow key={`${activeDay}-${slot.time}`}>
                      <TableCell className="font-semibold flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {slot.time}
                      </TableCell>
                      <TableCell className="font-semibold">{slot.title}</TableCell>
                      <TableCell className="text-muted-foreground">{slot.host}</TableCell>
                      <TableCell>
                        <Badge
                          variant={slot.media === "tv" ? "default" : "secondary"}
                          className="gap-1 uppercase tracking-wide"
                        >
                          {slot.media === "tv" ? <Tv className="h-3 w-3" /> : <Radio className="h-3 w-3" />}
                          {slot.media}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
