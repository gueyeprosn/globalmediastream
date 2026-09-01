import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import type { TrafficReport } from "@/lib/traffic/types"

export function useTraffic(refetchIntervalMs = 10_000) {
  return useQuery({
    queryKey: ["traffic-kpi"],
    queryFn: async (): Promise<TrafficReport> => {
      const res = await apiFetch("/api/traffic", { cache: "no-store" })
      const data = (await res.json()) as TrafficReport
      if (!res.ok && !data?.summary) {
        throw new Error(data?.srsError || `HTTP ${res.status}`)
      }
      return data
    },
    refetchInterval: refetchIntervalMs,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
  })
}
