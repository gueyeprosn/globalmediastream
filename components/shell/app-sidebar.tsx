"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CircleDot,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react"
import { useAppStore } from "@/stores/useAppStore"
import { cn } from "@/lib/utils"
import { useStreams } from "@/hooks/useStreams"
import { useQuery } from "@tanstack/react-query"
import { useServiceHealth } from "@/hooks/useServiceHealth"
import { HealthBadge } from "@/components/health/ResourceGauge"
import { apiFetch } from "@/lib/api-fetch"
import { Button } from "@/components/ui/button"
import { NAV_ITEMS, NAV_SECTIONS, ORYX_MGMT_URL } from "@/components/shell/nav-config"

type RecordingsResponse = {
  active?: Array<{ streamId: string }>
}

export function AppSidebar() {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, toggleSidebarCollapsed } =
    useAppStore()
  const { data: streams = [] } = useStreams()
  const {
    services: healthServices,
    uptime,
    loading: healthLoading,
    overallStatus,
    score,
  } = useServiceHealth()
  const { data: recordingsData } = useQuery<RecordingsResponse>({
    queryKey: ["recordings"],
    queryFn: async () => {
      const response = await apiFetch("/api/recordings", { cache: "no-store" })
      if (!response.ok) throw new Error("Failed to fetch recordings")
      return response.json()
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
  })

  const badgeCounts = {
    activeStreams: streams.filter((stream: { status?: string }) => stream.status === "running")
      .length,
    activeRecordings: recordingsData?.active?.length ?? 0,
  }

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 border-r border-sidebar-border bg-sidebar/95 backdrop-blur-md transition-[width,transform] duration-300 ease-out",
          sidebarCollapsed ? "w-[4.5rem]" : "w-64 lg:w-72",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        aria-label="Navigation principale"
      >
        <div className="relative flex h-full flex-col">
          <div
            className={cn(
              "flex border-b border-sidebar-border",
              sidebarCollapsed
                ? "h-auto flex-col items-center gap-2 px-2 py-3"
                : "h-14 items-center justify-between px-4"
            )}
          >
            {!sidebarCollapsed ? (
              <div className="flex min-w-0 items-center gap-2.5">
                <img
                  src="/logo-broadcast-sn.png"
                  alt="Broadcast SN"
                  className="h-7 w-auto shrink-0 rounded-md bg-white/90 px-1 py-0.5"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                    Stream Center
                  </p>
                  <p className="truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Broadcast SN
                  </p>
                </div>
              </div>
            ) : (
              <img
                src="/logo-broadcast-sn.png"
                alt="Broadcast SN"
                className="h-8 w-8 rounded-md bg-white/90 p-0.5"
              />
            )}

            <div className={cn("flex items-center gap-1", sidebarCollapsed && "flex-col")}>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="hidden h-8 w-8 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground lg:inline-flex"
                onClick={toggleSidebarCollapsed}
                aria-label={
                  sidebarCollapsed ? "Déplier la barre latérale" : "Réduire la barre latérale"
                }
                title={sidebarCollapsed ? "Déplier" : "Réduire"}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground lg:hidden"
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <nav className="scrollbar-core flex-1 overflow-y-auto px-2 py-4 lg:px-3">
            {NAV_SECTIONS.map((section) => (
              <div key={section} className={cn("mb-5 last:mb-0", sidebarCollapsed && "mb-3")}>
                {!sidebarCollapsed ? (
                  <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
                    {section}
                  </p>
                ) : null}
                <div className="space-y-0.5">
                  {NAV_ITEMS.filter((item) => item.section === section).map((item) => {
                    const Icon = item.icon
                    const isActive =
                      item.path === "/" ? pathname === "/" : pathname.startsWith(item.path)
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        title={sidebarCollapsed ? item.label : undefined}
                        onClick={() => {
                          if (window.innerWidth < 1024) setSidebarOpen(false)
                        }}
                        className={cn(
                          "group flex items-center rounded-lg text-sm font-medium transition-colors duration-150",
                          sidebarCollapsed
                            ? "justify-center px-2 py-2.5 lg:min-h-10"
                            : "gap-3 px-3 py-2 lg:min-h-10",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0",
                            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                        {!sidebarCollapsed ? (
                          <>
                            <span className="flex-1 truncate tracking-tight">{item.label}</span>
                            {item.path === "/" ? (
                              <span className="inline-flex h-5 items-center rounded-md bg-primary/15 px-1.5 text-[10px] font-semibold tracking-wide text-primary">
                                LIVE
                              </span>
                            ) : null}
                            {item.badgeKey && badgeCounts[item.badgeKey] > 0 ? (
                              <span
                                className={cn(
                                  "inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums",
                                  item.badgeKey === "activeRecordings"
                                    ? "bg-destructive/15 text-red-400"
                                    : "bg-primary/15 text-primary"
                                )}
                              >
                                {badgeCounts[item.badgeKey]}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </Link>
                    )
                  })}
                </div>
                {section === "SYSTÈME" && !sidebarCollapsed ? (
                  <a
                    href={ORYX_MGMT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                  >
                    <ExternalLink className="h-[18px] w-[18px] shrink-0" />
                    <span className="flex-1 tracking-tight">Oryx / SRS Console</span>
                    <span className="rounded-md bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-400">
                      /mgmt
                    </span>
                  </a>
                ) : null}
              </div>
            ))}
          </nav>

          {!sidebarCollapsed ? (
            <div className="m-3 rounded-xl border border-border/80 bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Serveur{uptime ? ` · ${uptime}` : ""}
                </p>
                <HealthBadge status={overallStatus} score={score} className="text-[10px]" />
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {healthLoading ? (
                  <p>Chargement…</p>
                ) : healthServices.length === 0 ? (
                  <p>Statuts indisponibles</p>
                ) : (
                  healthServices.map((service) => (
                    <div key={service.name} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <CircleDot
                          className={`h-3 w-3 shrink-0 ${service.ok ? "animate-pulse-live" : ""} ${service.color}`}
                        />
                        <span className="truncate text-foreground/80">{service.name}</span>
                      </span>
                      <span
                        className={`max-w-[45%] shrink-0 truncate text-right font-medium ${service.color}`}
                        title={service.status}
                      >
                        {service.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="mx-2 mb-3 flex justify-center">
              <span
                className={cn(
                  "inline-flex h-2.5 w-2.5 rounded-full",
                  healthServices.every((s) => s.ok) && healthServices.length > 0
                    ? "animate-pulse-live bg-primary"
                    : "bg-amber-400"
                )}
                title={
                  healthServices.every((s) => s.ok) ? "Services OK" : "Service en alerte"
                }
              />
            </div>
          )}
        </div>
      </aside>

      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      ) : null}
    </>
  )
}
