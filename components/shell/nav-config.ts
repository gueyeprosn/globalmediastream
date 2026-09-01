import type { ComponentType } from "react"
import {
  LayoutDashboard,
  RadioTower,
  Activity,
  Film,
  Settings,
  Link2,
  Radio,
  Video,
  Music2,
  FileWarning,
  ClipboardList,
  ScrollText,
  MapPinned,
  MonitorPlay,
  Network,
  History,
} from "lucide-react"

export type SidebarBadgeKey = "activeStreams" | "activeRecordings"

export type NavSection = "PRINCIPAL" | "MÉDIAS" | "PROTOCOLES" | "OPÉRATIONS" | "SYSTÈME"

export type NavItem = {
  section: NavSection
  path: string
  label: string
  icon: ComponentType<{ className?: string }>
  badgeKey?: SidebarBadgeKey
}

export const NAV_SECTIONS: NavSection[] = [
  "PRINCIPAL",
  "MÉDIAS",
  "PROTOCOLES",
  "OPÉRATIONS",
  "SYSTÈME",
]

export const NAV_ITEMS: NavItem[] = [
  { section: "PRINCIPAL", path: "/", label: "Dashboard", icon: LayoutDashboard },
  {
    section: "PRINCIPAL",
    path: "/streams",
    label: "Flux en direct",
    icon: RadioTower,
    badgeKey: "activeStreams",
  },
  { section: "PRINCIPAL", path: "/monitoring", label: "Monitoring", icon: Activity },
  { section: "PRINCIPAL", path: "/traffic", label: "Trafic & KPI", icon: Network },
  {
    section: "MÉDIAS",
    path: "/recordings",
    label: "Enregistrements",
    icon: Film,
    badgeKey: "activeRecordings",
  },
  { section: "MÉDIAS", path: "/endpoints", label: "Endpoints / Liens", icon: Link2 },
  { section: "PROTOCOLES", path: "/srt", label: "Contrôle SRT", icon: Radio },
  { section: "PROTOCOLES", path: "/rtmp", label: "Flux RTMP", icon: Video },
  { section: "PROTOCOLES", path: "/icecast", label: "Sources Icecast", icon: Music2 },
  {
    section: "OPÉRATIONS",
    path: "/incidents",
    label: "Incidents & runbook",
    icon: FileWarning,
  },
  {
    section: "OPÉRATIONS",
    path: "/plan-actions",
    label: "Plan d'actions",
    icon: ClipboardList,
  },
  { section: "OPÉRATIONS", path: "/logs", label: "Journaux", icon: ScrollText },
  {
    section: "OPÉRATIONS",
    path: "/points-diffusion",
    label: "Points de diffusion",
    icon: MapPinned,
  },
  { section: "SYSTÈME", path: "/settings", label: "Configuration", icon: Settings },
  {
    section: "SYSTÈME",
    path: "/srs-console",
    label: "Console SRS (infos)",
    icon: MonitorPlay,
  },
  { section: "SYSTÈME", path: "/audit", label: "Journal d'audit", icon: History },
]

export const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/streams": "Flux en direct",
  "/monitoring": "Monitoring",
  "/traffic": "Trafic & KPI",
  "/recordings": "Enregistrements",
  "/endpoints": "Endpoints / Liens",
  "/srt": "Contrôle SRT",
  "/rtmp": "Flux RTMP",
  "/icecast": "Sources Icecast",
  "/incidents": "Incidents & runbook",
  "/plan-actions": "Plan d'actions",
  "/logs": "Journaux",
  "/points-diffusion": "Points de diffusion",
  "/settings": "Configuration",
  "/srs-console": "Console SRS",
  "/audit": "Journal d'audit",
}

export const ORYX_MGMT_URL = "https://stream.broadcastsn.com/mgmt/"
