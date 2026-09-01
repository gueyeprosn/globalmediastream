/**
 * Client vers l'API interne d'ops-engine (§B2, Media Gateway). Timeout
 * court + tout appelant DOIT prévoir un repli sur la collecte directe —
 * ops-engine est une optimisation (évite de recalculer à chaque requête),
 * jamais une dépendance dure : si le process est down/pas encore démarré,
 * le dashboard continue de fonctionner comme avant.
 */

import type { HostDiskGb, HostMemoryMb } from '@/lib/host-metrics'
import type { SystemHealthReport } from '@/lib/health/scoring'

const OPS_ENGINE_BASE_URL =
  process.env.OPS_ENGINE_URL || `http://127.0.0.1:${process.env.OPS_ENGINE_PORT || 3011}`
const DEFAULT_TIMEOUT_MS = 1_500

export class OpsEngineUnavailableError extends Error {}

async function opsEngineFetch<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${OPS_ENGINE_BASE_URL}${path}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new OpsEngineUnavailableError(`ops-engine HTTP ${res.status}`)
    }
    return (await res.json()) as T
  } catch (err) {
    if (err instanceof OpsEngineUnavailableError) throw err
    throw new OpsEngineUnavailableError(err instanceof Error ? err.message : String(err))
  } finally {
    clearTimeout(timer)
  }
}

export type OpsSystemSnapshot = {
  collectedAt: string
  report: SystemHealthReport
  metrics: {
    cpuUsage: number
    memory: HostMemoryMb
    disk: HostDiskGb
    services: { nginx: 'active' | 'inactive'; pm2: 'active' | 'inactive'; icecast2: 'active' | 'inactive' }
    docker: { srs: 'running' | 'stopped' | 'unknown'; oryx: 'running' | 'stopped' | 'unknown' }
    dockerUptime: { srs: string | undefined; oryx: string | undefined }
  }
  srs: { ok: boolean; publisherCount: number }
}

/**
 * Renvoie l'instantané système en cache côté ops-engine (mis à jour toutes
 * les OPS_ENGINE_TICK_MS, 10s par défaut — donc potentiellement jusqu'à ~10s
 * "vieux", contre calcul exact à chaque appel avec la collecte directe).
 * Lève OpsEngineUnavailableError si le process ne répond pas — à l'appelant
 * de retomber sur la collecte directe.
 */
export async function getOpsSystemSnapshot(timeoutMs?: number): Promise<OpsSystemSnapshot> {
  return opsEngineFetch<OpsSystemSnapshot>('/metrics/system', timeoutMs)
}
