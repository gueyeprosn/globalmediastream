"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { checkSession } from "@/lib/auth"
import { Loader2 } from "lucide-react"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === "/login" || pathname === "/watch") {
      setLoading(false)
      setAuthenticated(false)
      return
    }

    let cancelled = false
    ;(async () => {
      const ok = await checkSession()
      if (cancelled) return
      if (ok) {
        setAuthenticated(true)
      } else {
        setAuthenticated(false)
        router.push("/login")
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [router, pathname])

  if (pathname === "/login" || pathname === "/watch") {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Vérification de l&apos;authentification...</p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return null
  }

  return <>{children}</>
}
