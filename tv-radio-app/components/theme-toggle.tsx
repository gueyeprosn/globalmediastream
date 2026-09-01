"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { useAppStore } from "@/stores/useAppStore"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const updateSettings = useAppStore((s) => s.updateSettings)
  const setStoreTheme = useAppStore((s) => s.setTheme)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Thème">
        <Sun className="h-4 w-4" />
      </Button>
    )
  }

  const isDark = resolvedTheme === "dark"

  const toggle = () => {
    const next = isDark ? "light" : "dark"
    setTheme(next)
    setStoreTheme(next)
    updateSettings({ theme: next })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
      title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Basculer le thème</span>
    </Button>
  )
}
