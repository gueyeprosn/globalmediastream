import { create } from 'zustand'
import type { AppSettings, Alert } from '@/types/streams'

const SETTINGS_STORAGE_KEY = 'stream-manager-settings'
const SIDEBAR_COLLAPSED_KEY = 'stream-sidebar-collapsed'

interface AppState {
  theme: 'light' | 'dark'
  settings: AppSettings
  alerts: Alert[]
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  
  setTheme: (theme: 'light' | 'dark') => void
  updateSettings: (settings: Partial<AppSettings>) => void
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>) => void
  acknowledgeAlert: (alertId: string) => void
  setSidebarOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarCollapsed: () => void
}

const defaultSettings: AppSettings = {
  autoStartStreams: false,
  defaultLatency: 2000,
  theme: 'system',
  updateCheck: true,
  serverHost: 'broadcast.sn',
  rtmpPort: 1935,
  srtPort: 9000,
  srtLatencyMs: 200,
  cdnBaseUrl: 'https://cdn.broadcast.sn/hls',
  recordingsPath: '/var/recordings',
  ffmpegPath: '/usr/bin/ffmpeg',
  srtLiveTransmitPath: '/usr/bin/srt-live-transmit',
  nginxRtmpPath: '/usr/sbin/nginx',
  icecastPath: '/usr/bin/icecast2',
  uiDensity: 'comfortable',
}

function loadPersistedSettings(): AppSettings {
  if (typeof window === 'undefined') return defaultSettings
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return { ...defaultSettings, ...parsed }
  } catch {
    return defaultSettings
  }
}

function loadSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'dark',
  settings: loadPersistedSettings(),
  alerts: [],
  sidebarOpen: false,
  sidebarCollapsed: loadSidebarCollapsed(),
  
  setTheme: (theme) => set({ theme }),
  
  updateSettings: (newSettings) =>
    set((state) => {
      const next = { ...state.settings, ...newSettings }
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next))
        } catch {}
      }
      return { settings: next }
    }),
  
  addAlert: (alert) =>
    set((state) => ({
      alerts: [
        ...state.alerts,
        {
          ...alert,
          id: Date.now().toString(),
          timestamp: Date.now(),
          acknowledged: false,
        },
      ],
    })),
  
  acknowledgeAlert: (alertId) =>
    set((state) => ({
      alerts: state.alerts.map((alert) =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      ),
    })),
  
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setSidebarCollapsed: (collapsed) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
      } catch {}
    }
    set({ sidebarCollapsed: collapsed })
  },

  toggleSidebarCollapsed: () =>
    set((state) => {
      const next = !state.sidebarCollapsed
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
        } catch {}
      }
      return { sidebarCollapsed: next }
    }),
}))

