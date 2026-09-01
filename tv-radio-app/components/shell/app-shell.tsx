"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/stores/useAppStore"
import { AppSidebar } from "@/components/shell/app-sidebar"
import { AppTopbar } from "@/components/shell/app-topbar"
import { AppBreadcrumb } from "@/components/shell/app-breadcrumb"
import { densityPadding, maxContentWidth } from "@/lib/design-tokens"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { setTheme: setNextTheme } = useTheme()
  const { setTheme, settings, sidebarCollapsed } = useAppStore()
  const density = settings.uiDensity || "comfortable"

  useEffect(() => {
    const pref = settings.theme || "system"
    setNextTheme(pref)
    if (pref === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      setTheme(systemTheme)
    } else {
      setTheme(pref)
    }
  }, [settings.theme, setTheme, setNextTheme])

  return (
    <div
      className={cn(
        "min-h-screen bg-background text-foreground",
        density === "compact" && "density-compact"
      )}
    >
      <AppSidebar />
      <div
        className={cn(
          "min-h-screen transition-[padding] duration-300 ease-out",
          sidebarCollapsed ? "lg:pl-[4.5rem]" : "lg:pl-72"
        )}
      >
        <AppTopbar />
        <main className={cn(densityPadding[density])}>
          <div className={cn("mx-auto w-full", maxContentWidth)}>
            <AppBreadcrumb />
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  )
}
