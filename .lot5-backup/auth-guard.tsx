"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { isAuthenticated } from "@/lib/auth"
import { Loader2 } from "lucide-react"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Ne pas protéger la page de login et la page de lecture publique
    if (pathname === '/login' || pathname === '/watch') {
      setLoading(false)
      return
    }

    // Vérifier l'authentification
    const checkAuth = () => {
      if (isAuthenticated()) {
        setAuthenticated(true)
      } else {
        router.push('/login')
      }
      setLoading(false)
    }

    checkAuth()
  }, [router, pathname])

  // Page de login ou page de lecture publique - pas de protection
  if (pathname === '/login' || pathname === '/watch') {
    return <>{children}</>
  }

  // En cours de vérification
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Vérification de l'authentification...</p>
        </div>
      </div>
    )
  }

  // Non authentifié - redirection gérée dans useEffect
  if (!authenticated) {
    return null
  }

  // Authentifié - afficher le contenu
  return <>{children}</>
}

