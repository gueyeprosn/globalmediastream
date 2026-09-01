import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-fetch'
import type { Stream } from '@/types/streams'

// Map API status (active/inactive/error) to UI status (running/stopped/error)
function normalizeStreamStatus(apiStatus: string): 'running' | 'stopped' | 'error' {
  if (apiStatus === 'active') return 'running'
  if (apiStatus === 'inactive') return 'stopped'
  return 'error'
}

function normalizeStream(raw: Record<string, unknown>): Stream {
  const status = normalizeStreamStatus((raw.status as string) || 'inactive')
  const protocol = (raw.protocol || raw.type || 'srt') as Stream['protocol']
  return { ...raw, status, protocol } as Stream
}

// Adapter les API existantes
export const useStreams = () => {
  return useQuery({
    queryKey: ['streams'],
    queryFn: async () => {
      const response = await apiFetch('/api/streams', { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to fetch streams')
      const data = await response.json()
      const streams = data.streams || []
      return streams.map((s: Record<string, unknown>) => normalizeStream(s))
    },
    refetchInterval: 12_000,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
  })
}

export const useStream = (id: string) => {
  return useQuery({
    queryKey: ['stream', id],
    queryFn: async () => {
      const response = await apiFetch(`/api/streams/${id}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to fetch stream')
      return await response.json()
    },
    enabled: !!id,
  })
}

export const useStartStream = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiFetch(`/api/streams/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      if (!response.ok) throw new Error('Failed to start stream')
      return await response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] })
    },
  })
}

export const useStopStream = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiFetch(`/api/streams/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
      if (!response.ok) throw new Error('Failed to stop stream')
      return await response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] })
    },
  })
}

export const useRestartStream = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiFetch(`/api/streams/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' }),
      })
      if (!response.ok) throw new Error('Failed to restart stream')
      return await response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] })
    },
  })
}

