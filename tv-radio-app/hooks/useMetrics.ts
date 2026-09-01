import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-fetch'
import type { StreamMetrics, GlobalMetrics } from '@/types/streams'

interface AdvancedStreamMetrics {
  id: string
  name: string
  type: 'rtmp' | 'srt'
  status: 'active' | 'inactive'
  bitrateVideo?: number
  bitrateAudio?: number
  resolution?: string
  framerate?: number
  codecVideo?: string
  codecAudio?: string
  publisherIP?: string
  viewers?: number
  lastUpdated?: string
  error?: string
}

interface SystemMetricsResponse {
  cpuUsage: number
  cpuLoad: {
    load1: number
    load5: number
    load15: number
  }
  memory: {
    total: number
    used: number
    free: number
    cached: number
    percentage: number
  }
  disk: {
    total: number
    used: number
    free: number
    percentage: number
    mountPoint: string
  }
  network: {
    interfaces: Array<{
      name: string
      rxBytes: number
      txBytes: number
    }>
  }
  processes: {
    total: number
    running: number
    sleeping: number
    zombie: number
  }
  services: {
    nginx: 'active' | 'inactive'
    pm2: 'active' | 'inactive'
    icecast2: 'active' | 'inactive'
  }
  uptime: string
  timestamp: string
}

// API réelle - Utilise les endpoints backend
const api = {
  getStreamMetrics: async (streamId: string): Promise<StreamMetrics> => {
    // Récupérer les métriques avancées depuis l'API
    const response = await apiFetch('/api/streams/advanced', { cache: 'no-store' })
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des métriques')
    }
    
    const data = await response.json()
    const stream = (data.streams || []).find((s: AdvancedStreamMetrics) => s.id === streamId)
    
    if (!stream) {
      // Retourner des métriques par défaut si le stream n'est pas trouvé
      return {
        streamId,
        timestamp: Date.now(),
        bitrate: 0,
        connections: 0,
        cpuUsage: 0,
        memoryUsage: 0,
      }
    }
    
    // Calculer le bitrate total (vidéo + audio)
    const totalBitrate = (stream.bitrateVideo || 0) + (stream.bitrateAudio || 0)
    
    // Récupérer les métriques système pour CPU et mémoire du stream
    const streamsResponse = await apiFetch('/api/streams', { cache: 'no-store' })
    const streamsData = await streamsResponse.json()
    const streamInfo = (streamsData.streams || []).find((s: any) => s.id === streamId)
    
    return {
      streamId,
      timestamp: stream.lastUpdated ? new Date(stream.lastUpdated).getTime() : Date.now(),
      bitrate: totalBitrate || 0,
      latency: stream.type === 'srt' ? undefined : undefined, // SRT latency nécessite des outils spécifiques
      jitter: undefined, // Nécessite des outils spécifiques
      packetLoss: undefined, // Nécessite des outils spécifiques
      retransmissions: undefined, // Nécessite des outils spécifiques
      connections: stream.viewers || 0,
      cpuUsage: streamInfo?.cpu || 0,
      memoryUsage: parseFloat(streamInfo?.memory?.replace(' MB', '') || '0') || 0,
    }
  },

  getAllStreamMetrics: async (): Promise<StreamMetrics[]> => {
    // Récupérer les métriques avancées depuis l'API
    const response = await apiFetch('/api/streams/advanced', { cache: 'no-store' })
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des métriques')
    }
    
    const data = await response.json()
    const advancedStreams: AdvancedStreamMetrics[] = data.streams || []
    
    // Récupérer les informations des streams (CPU, mémoire)
    const streamsResponse = await apiFetch('/api/streams', { cache: 'no-store' })
    const streamsData = await streamsResponse.json()
    const streams = streamsData.streams || []
    
    return advancedStreams.map((stream) => {
      const streamInfo = streams.find((s: any) => s.id === stream.id)
      
      // Calculer le bitrate total (vidéo + audio)
      const totalBitrate = (stream.bitrateVideo || 0) + (stream.bitrateAudio || 0)
      
      return {
        streamId: stream.id,
        timestamp: stream.lastUpdated ? new Date(stream.lastUpdated).getTime() : Date.now(),
        bitrate: totalBitrate || 0,
        latency: stream.type === 'srt' ? undefined : undefined,
        jitter: undefined,
        packetLoss: undefined,
        retransmissions: undefined,
        connections: stream.viewers || 0,
        cpuUsage: streamInfo?.cpu || 0,
        memoryUsage: parseFloat(streamInfo?.memory?.replace(' MB', '') || '0') || 0,
      }
    })
  },

  getGlobalMetrics: async (): Promise<GlobalMetrics> => {
    // Récupérer les métriques système
    const systemResponse = await apiFetch('/api/system/metrics', { cache: 'no-store' })
    if (!systemResponse.ok) {
      throw new Error('Erreur lors de la récupération des métriques système')
    }
    const systemData: SystemMetricsResponse = await systemResponse.json()
    
    // Récupérer les streams et leurs métriques
    const streamsResponse = await apiFetch('/api/streams', { cache: 'no-store' })
    const streamsData = await streamsResponse.json()
    const streams = streamsData.streams || []
    const activeStreams = streams.filter((s: any) => s.status === 'active')
    
    // Récupérer les métriques avancées pour calculer le bandwidth total
    const advancedResponse = await apiFetch('/api/streams/advanced', { cache: 'no-store' })
    const advancedData = await advancedResponse.json()
    const advancedStreams: AdvancedStreamMetrics[] = advancedData.streams || []
    
    // Calculer le bandwidth total des streams actifs
    const totalBandwidth = activeStreams.reduce((sum: number, stream: any) => {
      const advanced = advancedStreams.find((a: AdvancedStreamMetrics) => a.id === stream.id)
      if (advanced && advanced.status === 'active') {
        const bitrate = (advanced.bitrateVideo || 0) + (advanced.bitrateAudio || 0)
        return sum + bitrate
      }
      // Estimation par défaut si pas de métriques
      return sum + (stream.type === 'srt' ? 2500 : stream.type === 'rtmp' ? 3000 : 128)
    }, 0)
    
    // Parser l'uptime string pour obtenir les millisecondes
    // Format: "X days, Y hours, Z minutes" ou "X hours, Y minutes" ou "X minutes"
    const parseUptime = (uptimeStr: string): number => {
      try {
        // Essayer de parser depuis /proc/uptime directement
        // Pour l'instant, on va utiliser une estimation basée sur le format string
        const daysMatch = uptimeStr.match(/(\d+)\s*days?/i)
        const hoursMatch = uptimeStr.match(/(\d+)\s*hours?/i)
        const minutesMatch = uptimeStr.match(/(\d+)\s*minutes?/i)
        const weeksMatch = uptimeStr.match(/(\d+)\s*weeks?/i)
        
        const weeks = weeksMatch ? parseInt(weeksMatch[1]) : 0
        const days = daysMatch ? parseInt(daysMatch[1]) : 0
        const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0
        const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0
        
        const totalMs = 
          (weeks * 7 * 24 * 60 * 60 * 1000) +
          (days * 24 * 60 * 60 * 1000) +
          (hours * 60 * 60 * 1000) +
          (minutes * 60 * 1000)
        
        return totalMs
      } catch {
        // En cas d'erreur, retourner 0
        return 0
      }
    }
    
    const uptimeMs = parseUptime(systemData.uptime || '0 minutes')
    
    return {
      totalActiveStreams: activeStreams.length,
      totalBandwidth: totalBandwidth,
      cpuUsage: systemData.cpuUsage || 0,
      memoryUsage: systemData.memory.percentage || 0,
      packetLoss: 0, // Nécessite des outils spécifiques pour mesurer
      uptime: uptimeMs,
    }
  },
}

export const useStreamMetrics = (streamId: string) => {
  return useQuery({
    queryKey: ['metrics', streamId],
    queryFn: () => api.getStreamMetrics(streamId),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    enabled: !!streamId,
  })
}

export const useAllStreamMetrics = () => {
  return useQuery({
    queryKey: ['metrics', 'all'],
    queryFn: () => api.getAllStreamMetrics(),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })
}

export const useGlobalMetrics = () => {
  return useQuery({
    queryKey: ['metrics', 'global'],
    queryFn: () => api.getGlobalMetrics(),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })
}

/** Métriques système complètes du VPS (CPU, RAM, disque, réseau, processus, services) */
export const useSystemMetrics = () => {
  return useQuery({
    queryKey: ['metrics', 'system'],
    queryFn: async (): Promise<SystemMetricsResponse> => {
      const res = await apiFetch('/api/system/metrics', { cache: 'no-store' })
      if (!res.ok) throw new Error('Erreur métriques système')
      return res.json()
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })
}

