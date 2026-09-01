import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"

type SrsSessionsResponse = {
  streams: Array<any>
  clients: Array<any>
}

export function useSrsSessions() {
  return useQuery({
    queryKey: ["srs-sessions"],
    queryFn: async (): Promise<SrsSessionsResponse> => {
      const res = await apiFetch("/api/srs/sessions", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load SRS sessions")
      return (await res.json()) as SrsSessionsResponse
    },
    refetchInterval: 12_000,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
  })
}

export function useKickSrsClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (cid: string) => {
      const res = await apiFetch(`/api/srs/clients/${encodeURIComponent(cid)}`, {
        method: "DELETE",
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Failed to kick SRS client")
      return await res.json().catch(() => ({}))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["srs-sessions"] })
      queryClient.invalidateQueries({ queryKey: ["traffic-kpi"] })
    },
  })
}

export function useReloadSrsConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/srs/reload", {
        method: "POST",
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Failed to reload SRS config")
      return await res.json().catch(() => ({}))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["srs-sessions"] })
    },
  })
}

