"use client"

import Link from "next/link"
import { Activity, Wifi, Clock, Menu, LogOut, Tv, Plus, Link2 } from "lucide-react"
import { useGlobalMetrics } from "@/hooks/useMetrics"
import { formatDistanceToNow } from "date-fns"
import { useAppStore } from "@/stores/useAppStore"
import { ThemeToggle } from "@/components/theme-toggle"
import { logout, getCurrentUser } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function Header() {
  const { data: metrics } = useGlobalMetrics()
  const { sidebarOpen, setSidebarOpen } = useAppStore()
  const router = useRouter()
  const user = getCurrentUser()

  const formatUptime = (ms: number) => {
    return formatDistanceToNow(new Date(Date.now() - ms), {
      addSuffix: false,
    })
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-[var(--sidebar-border)] bg-[var(--sidebar)]/90 backdrop-blur-sm">
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-slate-800/80 hover:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img src="/logo-broadcast-sn.png" alt="Broadcast SN" className="h-7 w-auto rounded-sm bg-white/90 px-1 py-0.5" />
            <h2 className="text-lg font-semibold text-white lg:hidden">
            BSN Stream Center
          </h2>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 text-muted-foreground">
            <Link
              href="/watch"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"
            >
              <Tv className="h-4 w-4" />
              Voir le direct
            </Link>
            <div className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-green-500" />
              <span className="font-medium">
                {metrics?.totalActiveStreams || 0} actifs
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Wifi className="h-4 w-4 text-blue-500" />
              <span className="font-medium">
                {(metrics?.totalBandwidth || 0).toFixed(0)} kbps
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-purple-500" />
              <span className="font-medium">
                {metrics ? formatUptime(metrics.uptime) : "N/A"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/points-diffusion">
                <Button variant="outline" size="sm" className="border-cyan-400/30 bg-slate-900/80 text-foreground hover:bg-cyan-500/10">
                  <Link2 className="mr-2 h-4 w-4" />
                  Liens HLS
                </Button>
              </Link>
              <Link href="/rtmp">
                <Button size="sm" className="bg-[var(--brand-gold)] text-[#201500] hover:brightness-110">
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau flux
                </Button>
              </Link>
            </div>
            <ThemeToggle />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {user?.username?.charAt(0).toUpperCase() || 'A'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.username || 'Admin'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      Administrateur
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
                  <LogOut className="mr-2 h-4 w-4" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}

