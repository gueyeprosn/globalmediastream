import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { computeSystemHealth } from '@/lib/health/scoring'
import { getDockerContainerUptime } from '@/lib/health/docker-uptime'
import type { SystemMetrics } from '@/app/api/system/metrics/route'

const execAsync = promisify(exec)

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

async function getMemoryMetrics(): Promise<SystemMetrics['memory']> {
  try {
    const { stdout } = await execAsync('free -m')
    const lines = stdout.split('\n')
    const memLine = lines[1].split(/\s+/)
    const total = parseInt(memLine[1])
    const used = parseInt(memLine[2])
    const free = parseInt(memLine[3])
    const cached = parseInt(memLine[5]) || 0
    return {
      total,
      used,
      free,
      cached,
      percentage: Math.round((used / total) * 100),
    }
  } catch {
    return { total: 0, used: 0, free: 0, cached: 0, percentage: 0 }
  }
}

async function getDiskMetrics(): Promise<SystemMetrics['disk']> {
  try {
    const { stdout } = await execAsync("df -BG / | tail -1 | awk '{print $2,$3,$4,$5,$6}'")
    const parts = stdout.trim().split(/\s+/)
    return {
      total: parseFloat(parts[0].replace('G', '')),
      used: parseFloat(parts[1].replace('G', '')),
      free: parseFloat(parts[2].replace('G', '')),
      percentage: parseInt(parts[3].replace('%', '')),
      mountPoint: parts[4] || '/',
    }
  } catch {
    return { total: 0, used: 0, free: 0, percentage: 0, mountPoint: '/' }
  }
}

async function getCpuUsage(): Promise<number> {
  try {
    const { stdout } = await execAsync('vmstat 1 2 | tail -1')
    const parts = stdout.trim().split(/\s+/)
    const idle = parseFloat(parts[14])
    return Math.round(100 - idle)
  } catch {
    return 0
  }
}

async function getDockerStatus(): Promise<SystemMetrics['docker']> {
  const inspect = async (name: string): Promise<'running' | 'stopped' | 'unknown'> => {
    try {
      const { stdout } = await execAsync(`docker inspect -f '{{.State.Running}}' ${name} 2>/dev/null`)
      return stdout.trim() === 'true' ? 'running' : 'stopped'
    } catch {
      return 'unknown'
    }
  }
  const [srs, oryx] = await Promise.all([inspect('srs'), inspect('oryx')])
  return { srs, oryx }
}

async function getServicesStatus(): Promise<SystemMetrics['services']> {
  const checkService = async (service: string): Promise<'active' | 'inactive'> => {
    try {
      const { stdout } = await execAsync(`systemctl is-active ${service} 2>/dev/null || echo inactive`)
      return stdout.trim() === 'active' ? 'active' : 'inactive'
    } catch {
      return 'inactive'
    }
  }
  const checkPM2 = async (): Promise<'active' | 'inactive'> => {
    try {
      await execAsync('pm2 list > /dev/null 2>&1')
      return 'active'
    } catch {
      return 'inactive'
    }
  }
  return {
    nginx: await checkService('nginx'),
    pm2: await checkPM2(),
    icecast2: await checkService('icecast2'),
  }
}

export async function GET() {
  try {
    const [cpuUsage, memory, disk, services, docker, srsUptime, oryxUptime, srsStreams] =
      await Promise.all([
        getCpuUsage(),
        getMemoryMetrics(),
        getDiskMetrics(),
        getServicesStatus(),
        getDockerStatus(),
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
        metrics: { cpuUsage, memory, disk, services, docker, dockerUptime: { srs: srsUptime, oryx: oryxUptime } },
        srs: { ok: srsOk, publisherCount },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur santé système'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
