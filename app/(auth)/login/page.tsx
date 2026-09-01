"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { login, checkSession, logout } from "@/lib/auth"
import { ThemeToggle } from "@/components/theme-toggle"

export default function LoginPage() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    void checkSession().then((ok) => {
      if (!cancelled) setSessionActive(ok)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const ok = await login(password)
      if (ok) {
        setSessionActive(true)
        router.push("/")
      } else {
        setError("Mot de passe incorrect")
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(34,197,94,0.12), transparent 55%)",
        }}
        aria-hidden
      />
      <Card className="relative w-full max-w-md border-border/80 bg-card text-foreground shadow-none">
        <CardHeader className="space-y-1">
          <div className="mb-4 flex flex-col items-center justify-center gap-3">
            <img
              src="/logo-broadcast-sn.png"
              alt="Broadcast SN"
              className="h-10 w-auto dark:hidden"
            />
            <img
              src="/logo-broadcast-sn-blanc.png"
              alt="Broadcast SN"
              className="hidden h-10 w-auto dark:block"
            />
            <CardTitle className="text-center text-2xl font-semibold tracking-tight">
              Stream Center
            </CardTitle>
          </div>
          <CardDescription className="text-center">
            Connectez-vous pour accéder au panneau de contrôle
          </CardDescription>
          <div className="mt-4 space-y-1 text-center text-xs text-muted-foreground">
            <p className="font-medium text-foreground/80">Powered by Broadcast SN</p>
            <p>Email: broadcastsn.dkr@gmail.com</p>
            <p>Tel: +221 77 724 56 54</p>
          </div>
        </CardHeader>
        <CardContent>
          {sessionActive && (
            <Alert className="mb-4 border-border/80 bg-muted/30">
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>Session active détectée.</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    logout()
                    setSessionActive(false)
                    setError("")
                    setPassword("")
                  }}
                >
                  Déconnexion
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-border bg-input pl-10 text-foreground placeholder:text-muted-foreground"
                  placeholder="Entrez le mot de passe"
                  required
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Accès réservé aux administrateurs</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
