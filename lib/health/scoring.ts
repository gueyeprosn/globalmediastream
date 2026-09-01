import { levelForPercent, type HealthLevel } from './thresholds'

export type OverallHealthStatus = 'healthy' | 'degraded' | 'critical'

export type HealthComponent = {
  id: string
  label: string
  level: HealthLevel
  detail: string
}

export type SystemHealthReport = {
  score: number
  status: OverallHealthStatus
  components: HealthComponent[]
  timestamp: string
}

export type MetricsInput = {
  cpuUsage: number
  memory: { percentage: number }
  disk: { percentage: number }
  services: {
    nginx: 'active' | 'inactive'
    pm2: 'active' | 'inactive'
    icecast2: 'active' | 'inactive'
  }
  docker: {
    srs: 'running' | 'stopped' | 'unknown'
    oryx: 'running' | 'stopped' | 'unknown'
  }
  dockerUptime?: {
    srs?: string
    oryx?: string
  }
}

export type SrsHealthInput = {
  ok: boolean
  publisherCount?: number
}

function serviceLevel(active: boolean): HealthLevel {
  return active ? 'ok' : 'critical'
}

function dockerLevel(state: 'running' | 'stopped' | 'unknown'): HealthLevel {
  if (state === 'running') return 'ok'
  if (state === 'stopped') return 'critical'
  return 'warning'
}

function scoreFromLevels(levels: HealthLevel[]): number {
  if (levels.length === 0) return 0
  const weights: Record<HealthLevel, number> = { ok: 100, warning: 55, critical: 0 }
  const sum = levels.reduce((acc, l) => acc + weights[l], 0)
  return Math.round(sum / levels.length)
}

function statusFromScore(score: number, hasCritical: boolean): OverallHealthStatus {
  if (hasCritical || score < 50) return 'critical'
  if (score < 85) return 'degraded'
  return 'healthy'
}

export function computeSystemHealth(
  metrics: MetricsInput,
  srs?: SrsHealthInput
): SystemHealthReport {
  const components: HealthComponent[] = []

  const cpuLevel = levelForPercent(metrics.cpuUsage, 'cpu')
  components.push({
    id: 'cpu',
    label: 'CPU',
    level: cpuLevel,
    detail: `${metrics.cpuUsage.toFixed(1)}%`,
  })

  const ramLevel = levelForPercent(metrics.memory.percentage, 'ram')
  components.push({
    id: 'ram',
    label: 'RAM',
    level: ramLevel,
    detail: `${metrics.memory.percentage}%`,
  })

  const diskLevel = levelForPercent(metrics.disk.percentage, 'disk')
  components.push({
    id: 'disk',
    label: 'Disque',
    level: diskLevel,
    detail: `${metrics.disk.percentage}%`,
  })

  const srsDockerLevel = dockerLevel(metrics.docker.srs)
  components.push({
    id: 'docker-srs',
    label: 'SRS Docker',
    level: srsDockerLevel,
    detail: metrics.dockerUptime?.srs
      ? `${metrics.docker.srs} · ${metrics.dockerUptime.srs}`
      : metrics.docker.srs,
  })

  const oryxLevel = dockerLevel(metrics.docker.oryx)
  components.push({
    id: 'docker-oryx',
    label: 'Oryx Docker',
    level: oryxLevel,
    detail: metrics.dockerUptime?.oryx
      ? `${metrics.docker.oryx} · ${metrics.dockerUptime.oryx}`
      : metrics.docker.oryx,
  })

  components.push({
    id: 'nginx',
    label: 'Nginx',
    level: serviceLevel(metrics.services.nginx === 'active'),
    detail: metrics.services.nginx,
  })

  components.push({
    id: 'pm2',
    label: 'PM2 / Next.js',
    level: serviceLevel(metrics.services.pm2 === 'active'),
    detail: metrics.services.pm2 === 'active' ? 'online' : 'offline',
  })

  components.push({
    id: 'icecast',
    label: 'Icecast',
    level: serviceLevel(metrics.services.icecast2 === 'active'),
    detail: metrics.services.icecast2,
  })

  if (srs) {
    components.push({
      id: 'srs-api',
      label: 'SRS API :1985',
      level: srs.ok ? 'ok' : 'critical',
      detail: srs.ok ? '200 OK' : 'offline',
    })
  }

  const levels = components.map((c) => c.level)
  const hasCritical = levels.includes('critical')
  const score = scoreFromLevels(levels)

  return {
    score,
    status: statusFromScore(score, hasCritical),
    components,
    timestamp: new Date().toISOString(),
  }
}
