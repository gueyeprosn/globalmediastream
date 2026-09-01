import { spawnCapture } from '@/lib/safe-shell'

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}j ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export async function getDockerContainerUptime(name: string): Promise<string | undefined> {
  if (!/^[a-z][a-z0-9_-]{0,62}$/i.test(name)) return undefined
  try {
    const { stdout, code } = await spawnCapture(
      'docker',
      ['inspect', '-f', '{{.State.StartedAt}}', name],
      { timeoutMs: 8_000 }
    )
    if (code !== 0) return undefined
    const started = new Date(stdout.trim())
    if (Number.isNaN(started.getTime())) return undefined
    const seconds = Math.max(0, Math.floor((Date.now() - started.getTime()) / 1000))
    return formatDuration(seconds)
  } catch {
    return undefined
  }
}
