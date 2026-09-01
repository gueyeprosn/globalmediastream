import { describe, expect, it } from 'vitest'
import { computeSystemHealth } from './scoring'

const baseMetrics = {
  cpuUsage: 20,
  memory: { percentage: 40 },
  disk: { percentage: 30 },
  services: {
    nginx: 'active' as const,
    pm2: 'active' as const,
    icecast2: 'active' as const,
  },
  docker: {
    srs: 'running' as const,
    oryx: 'running' as const,
  },
}

describe('computeSystemHealth', () => {
  it('returns healthy when all metrics are ok', () => {
    const report = computeSystemHealth(baseMetrics, { ok: true })
    expect(report.status).toBe('healthy')
    expect(report.score).toBeGreaterThanOrEqual(85)
  })

  it('returns critical when SRS docker is stopped', () => {
    const report = computeSystemHealth(
      {
        ...baseMetrics,
        docker: { srs: 'stopped', oryx: 'running' },
      },
      { ok: false }
    )
    expect(report.status).toBe('critical')
    expect(report.components.find((c) => c.id === 'docker-srs')?.level).toBe('critical')
  })

  it('flags CPU warning above 85%', () => {
    const report = computeSystemHealth({ ...baseMetrics, cpuUsage: 88 }, { ok: true })
    expect(report.components.find((c) => c.id === 'cpu')?.level).toBe('warning')
  })
})
