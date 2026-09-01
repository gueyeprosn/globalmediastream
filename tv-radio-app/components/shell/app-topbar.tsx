"use client"

import Link from "next/link"
import { useMemo, useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, Menu, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StreamModal } from "@/components/StreamModal"
import { logout } from "@/lib/auth"
import { toast } from "sonner"
import { useAppStore } from "@/stores/useAppStore"
import { PAGE_TITLES } from "@/components/shell/nav-config"
import { ThemeToggle } from "@/components/theme-toggle"

export function AppTopbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { setSidebarOpen } = useAppStore()
  const [now, setNow] = useState(new Date())
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 5000)
    return () => clearInterval(t)
  }, [])

  const title = useMemo(() => PAGE_TITLES[pathname] || "Dashboard", [pathname])
  const utc = useMemo(
    () => `${now.toISOString().slice(0, 10)} ${now.toISOString().slice(11, 19)} UTC`,
    [now]
  )

  const handleLogout = () => {
    logout()
    toast.success("Déconnecté")
    router.push("/login")
  }

  return (
    <>
      <header className="sticky top-0 z-40 h-14 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="flex h-full items-center justify-between gap-2 px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 border-border bg-card text-muted-foreground lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <h2 className="truncate text-sm font-medium text-foreground sm:text-[15px]">{title}</h2>
          </div>
          <p className="hidden font-mono text-xs text-muted-foreground xl:block">{utc}</p>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Button
              asChild
              size="sm"
              variant="outline"
              className="hidden border-border bg-card text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              <Link href="/endpoints">Liens HLS</Link>
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground shadow-none hover:bg-primary/90"
              onClick={() => setOpen(true)}
              aria-label="Créer un nouveau flux SRS"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nouveau flux</span>
              <span className="sm:hidden">Nouveau</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>
      <StreamModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  )
}
