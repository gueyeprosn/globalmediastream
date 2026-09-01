/**
 * API route pour récupérer les métriques système du VPS
 * CPU, RAM, Disque, Réseau, Processus, Services — sans shell.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import {
  getCpuLoadFromProc,
  getCpuUsageFromProc,
  getDiskMetricsViaDf,
  getDockerStatusMap,
  getHostServicesStatus,
  getMemoryMetricsFromProc,
  getNetworkFromProc,
  getProcessMetricsFromProc,
  getUptimeFromProc,
} from '@/lib/host-metrics'

export interface SystemMetrics {
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
  docker: {
    srs: 'running' | 'stopped' | 'unknown'
    oryx: 'running' | 'stopped' | 'unknown'
  }
  uptime: string
  timestamp: string
}

export async function GET(request: NextRequest){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
    const [
      cpuUsage,
      cpuLoad,
      memory,
      disk,
      network,
      processes,
      services,
      docker,
      uptime,
    ] = await Promise.all([
      getCpuUsageFromProc(100),
      getCpuLoadFromProc(),
      getMemoryMetricsFromProc(),
      getDiskMetricsViaDf('/'),
      getNetworkFromProc(),
      getProcessMetricsFromProc(),
      getHostServicesStatus(),
      getDockerStatusMap(),
      getUptimeFromProc(),
    ])

    const metrics: SystemMetrics = {
      cpuUsage,
      cpuLoad,
      memory,
      disk,
      network,
      processes,
      services,
      docker,
      uptime,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Erreur métriques système:', msg)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des métriques système' },
      { status: 500 }
    )
  }
}
