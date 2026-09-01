import { NextRequest, NextResponse } from 'next/server'
import { computeSystemHealth } from '@/lib/health/scoring'
import { getDockerContainerUptime } from '@/lib/health/docker-uptime'
import { requireAuth } from '@/lib/require-auth'
import {
  getCpuUsageFromProc,
  getDiskMetricsViaDf,
  getDockerStatusMap,
  getHostServicesStatus,
  getMemoryMetricsFromProc,
} from '@/lib/host-metrics'

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

export async function GET(request: NextRequest){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
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
    if (srsStreams?.streams) {
      srsOk = true
      publisherCount = (srsStreams.streams as Array<{ publish?: { active?: boolean } }>).filter(
        (s) => s.publish?.active
      ).length
    }

    const report = computeSystemHealth(
      {
        cpuUsage,
        memory,
        disk,
        services,
        docker,
        dockerUptime: { srs: srsUptime, oryx: oryxUptime },
      },
      { ok: srsOk, publisherCount }
    )

    return NextResponse.json(
      {
        ...report,
        metrics: {
          cpuUsage,
          memory,
          disk,
          services,
          docker,
          dockerUptime: { srs: srsUptime, oryx: oryxUptime },
        },
        srs: { ok: srsOk, publisherCount },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Erreur health système:', msg)
    return NextResponse.json({ error: 'health unavailable' }, { status: 503 })
  }
}
