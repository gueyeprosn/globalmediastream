"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "operator-guide-progress"

type GuideStep = {
  id: string
  title: string
  description: string
  href: string
}

const STEPS: GuideStep[] = [
  {
    id: "health",
    title: "Vérifier la santé globale",
    description: "Consulter le score système et les seuils CPU/RAM/disque.",
    href: "/monitoring",
  },
  {
    id: "watch",
    title: "Prévisualiser un flux live",
    description: "Ouvrir le lecteur public et valider la lecture HLS.",
    href: "/watch",
  },
  {
    id: "create-srt",
    title: "Créer un point SRT test",
    description: "Utiliser le formulaire de création depuis le dashboard ou /srt.",
    href: "/",
  },
  {
    id: "validate-hls",
    title: "Valider la lecture HLS",
    description: "Vérifier le badge « Lecture OK » après création du flux.",
    href: "/srt",
  },
  {
    id: "recording",
    title: "Tester un enregistrement",
    description: "Démarrer puis arrêter un enregistrement HLS depuis /recordings.",
    href: "/recordings",
  },
  {
    id: "incidents",
    title: "Consulter le runbook incidents",
    description: "Se familiariser avec les actions rapides et procédures P1.",
    href: "/incidents",
  },
]

function loadProgress(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveProgress(done: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]))
  } catch {
    /* ignore */
  }
}

type OperatorGuideProps = {
  compact?: boolean
  className?: string
}

export function OperatorGuide({ compact, className }: OperatorGuideProps) {
  const [done, setDone] = useState<Set<string>>(new Set())

  useEffect(() => {
    setDone(loadProgress())
  }, [])

  const toggle = (id: string) => {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveProgress(next)
      return next
    })
  }

  const completed = done.size
  const total = STEPS.length

  return (
    <Card className={cn("border-border/80 bg-card", className)}>
      <CardHeader className={compact ? "py-3" : undefined}>
        <CardTitle className="text-base">Guide opérateur</CardTitle>
        <p className="text-sm font-normal text-muted-foreground">
          Progression : {completed}/{total}
        </p>
      </CardHeader>
      <CardContent className={cn("space-y-2", compact && "pt-0")}>
        {STEPS.map((step) => {
          const isDone = done.has(step.id)
          return (
            <div
              key={step.id}
              className="flex items-start gap-3 rounded-lg border border-border/80 bg-muted/30 p-3"
            >
              <button
                type="button"
                onClick={() => toggle(step.id)}
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-emerald-400"
                aria-label={isDone ? `Marquer non fait : ${step.title}` : `Marquer fait : ${step.title}`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", isDone && "text-muted-foreground line-through")}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
                <Button asChild variant="link" className="h-auto p-0 text-xs text-primary">
                  <Link href={step.href}>Ouvrir →</Link>
                </Button>
              </div>
            </div>
          )
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            setDone(new Set())
            saveProgress(new Set())
          }}
        >
          Réinitialiser la progression
        </Button>
      </CardContent>
    </Card>
  )
}

export function shouldShowOnboardingBanner(): boolean {
  if (typeof window === "undefined") return false
  try {
    if (localStorage.getItem("operator-guide-dismissed") === "1") return false
    const progress = loadProgress()
    return progress.size < STEPS.length
  } catch {
    return true
  }
}

export function dismissOnboardingBanner() {
  try {
    localStorage.setItem("operator-guide-dismissed", "1")
  } catch {
    /* ignore */
  }
}
