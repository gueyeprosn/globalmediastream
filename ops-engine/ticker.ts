/**
 * Boucle de collecte en arrière-plan. Réutilise tels quels les collecteurs
 * existants (lib/host-metrics.ts, lib/health/*) — même logique que
 * app/api/system/health/route.ts, mais exécutée sur un intervalle plutôt
 * qu'à chaque requête HTTP, avec un instantané mis en cache en mémoire pour
 * réponse immédiate côté API interne (voir index.ts).
 */

import {
  getCpuUsageFromProc,
  getDiskMetricsViaDf,
  getDockerStatusMap,
  getHostServicesStatus,
  getMemoryMetricsFromProc,
} from '../lib/host-metrics'
import { getDockerContainerUptime } from '../lib/health/docker-uptime'
import { computeSystemHealth, type SystemHealthReport } from '../lib/health/scoring'
import { insertSystemMetrics, pruneSystemMetrics } from './db'

export type SystemSnapshot = {
  collectedAt: string
  report: SystemHealthReport
  metrics: {
    cpuUsage: number
    memory: Awaited<ReturnType<typeof getMemoryMetricsFromProc>>
    disk: Awaited<ReturnType<typeof getDiskMetricsViaDf>>
    services: Awaited<ReturnType<typeof getHostServicesStatus>>
    docker: Awaited<ReturnType<typeof getDockerStatusMap>>
    dockerUptime: { srs?: string; oryx?: string }
  }
  srs: { ok: boolean; publisherCount: number }
}

let latestSnapshot: SystemSnapshot | null = null

export function getLatestSnapshot(): SystemSnapshot | null {
  return latestSnapshot
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 3000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function collectSystemSnapshot(): Promise<SystemSnapshot> {
  const [cpuUsage, memory, disk, services, docker, srsUptime, oryxUptime, srsStreams] =
    await Promise.all([
      getCpuUsageFromProc(100),
      getMemoryMetricsFromProc(),
      getDiskMetricsViaDf('/'),
      getHostServicesStatus(),
      getDockerStatusMap(),
      getDockerContainerUptime('srs'),
      getDockerContainerUptime('oryx'),
      fetchJsonWithTimeout('http://127.0.0.1:1985/api/v1/streams/').catch(() => null),
    ])

  let srsOk = false
  let publisherCount = 0
  if (srsStreams && typeof srsStreams === 'object' && 'streams' in srsStreams) {
    srsOk = true
    const streams = (srsStreams as { streams?: Array<{ publish?: { active?: boolean } }> }).streams
    publisherCount = (streams ?? []).filter((s) => s.publish?.active).length
  }

  const report = computeSystemHealth(
    { cpuUsage, memory, disk, services, docker, dockerUptime: { srs: srsUptime, oryx: oryxUptime } },
    { ok: srsOk, publisherCount }
  )

  return {
    collectedAt: new Date().toISOString(),
    report,
    metrics: { cpuUsage, memory, disk, services, docker, dockerUptime: { srs: srsUptime, oryx: oryxUptime } },
    srs: { ok: srsOk, publisherCount },
  }
}

async function tick(): Promise<void> {
  try {
    const snapshot = await collectSystemSnapshot()
    latestSnapshot = snapshot
    insertSystemMetrics({
      timestamp: snapshot.collectedAt,
      cpuUsage: snapshot.metrics.cpuUsage,
      memUsedMb: snapshot.metrics.memory?.used ?? null,
      memTotalMb: snapshot.metrics.memory?.total ?? null,
      diskUsedPercent: snapshot.metrics.disk?.percentage ?? null,
      diskFreeGb: snapshot.metrics.disk?.free ?? null,
      overallStatus: snapshot.report.status,
      overallScore: snapshot.report.score,
      srsPublisherCount: snapshot.srs.publisherCount,
    })
  } catch (err) {
    console.error(JSON.stringify({ time: new Date().toISOString(), level: 'error', scope: 'ticker', message: String(err) }))
  }
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let pruneTimer: ReturnType<typeof setInterval> | null = null

export function startTicker(intervalMs = 10_000): void {
  if (tickTimer) return
  void tick()
  tickTimer = setInterval(() => void tick(), intervalMs)
  // Purge quotidienne des échantillons > 14 jours.
  pruneTimer = setInterval(() => {
    try {
      pruneSystemMetrics(14)
    } catch (err) {
      console.error(JSON.stringify({ time: new Date().toISOString(), level: 'error', scope: 'ticker-prune', message: String(err) }))
    }
  }, 24 * 60 * 60 * 1000)
}

export function stopTicker(): void {
  if (tickTimer) clearInterval(tickTimer)
  if (pruneTimer) clearInterval(pruneTimer)
  tickTimer = null
  pruneTimer = null
}
