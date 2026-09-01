import { exec } from 'child_process'
import { promisify } from 'util'
import { countryForIp } from '@/lib/geo-lookup'

const execAsync = promisify(exec)

export type HlsViewerDetail = {
  viewers: number
  viewerCountries: Record<string, number>
  /** Échantillon d’IPs (limite serveur) */
  viewerIps: string[]
}

function normalizeIp(raw: string): string {
  return raw.replace(/^::ffff:/i, '').replace(/^\[/, '').replace(/\]$/, '').trim()
}

/**
 * Agrège les lecteurs HLS récents depuis les logs Nginx (GET .m3u8).
 * Couvre /rtmp-hls/&lt;id&gt;/, /live/&lt;id&gt;/ (SRS), /toubatv/, /external-tv…/ (FFmpeg SRT→HLS).
 */
export async function getHlsViewerDetailForStreams(
  streamIds: string[]
): Promise<Map<string, HlsViewerDetail>> {
  const result = new Map<string, HlsViewerDetail>()
  if (streamIds.length === 0) return result

  const idSet = new Set(streamIds)
  const logPath = process.env.NGINX_ACCESS_LOG || '/var/log/nginx/access.log'

  let text = ''
  try {
    const { stdout } = await execAsync(
      `tail -n 15000 "${logPath}" 2>/dev/null || true`,
      { maxBuffer: 10 * 1024 * 1024 }
    )
    text = stdout || ''
  } catch {
    return result
  }

  const ipsByStream = new Map<string, Set<string>>()
  for (const id of streamIds) ipsByStream.set(id, new Set())

  for (const line of text.split('\n')) {
    if (!line.includes('.m3u8')) continue
    const ipRaw = line.split(/\s/)[0]
    if (!ipRaw) continue
    const ip = normalizeIp(ipRaw)
    const m =
      line.match(/\/rtmp-hls\/([^/]+)\//) ||
      line.match(/\/live\/([^/]+)\//) ||
      line.match(/\/(toubatv)\//) ||
      line.match(/\/(external-tv(?:-[0-9]+)?)\//)
    if (!m?.[1]) continue
    const sid = m[1]
    if (!idSet.has(sid)) continue
    ipsByStream.get(sid)!.add(ip)
  }

  for (const id of streamIds) {
    const ips = [...(ipsByStream.get(id) || [])]
    const viewerCountries: Record<string, number> = {}
    for (const ip of ips) {
      const cc = (await countryForIp(ip)) || 'ZZ'
      viewerCountries[cc] = (viewerCountries[cc] || 0) + 1
    }
    result.set(id, {
      viewers: ips.length,
      viewerCountries,
      viewerIps: ips.slice(0, 64),
    })
  }

  return result
}
