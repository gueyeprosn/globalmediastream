/**
 * ffprobe sans shell : arguments séparés via spawnCapture + validation stricte d'URL.
 */

import { spawnCapture } from '@/lib/safe-shell'

export interface StreamMetrics {
  resolution?: string // Format: "1920x1080"
  width?: number
  height?: number
  framerate?: number // FPS
  bitrateVideo?: number // kbps
  bitrateAudio?: number // kbps
  codecVideo?: string
  codecAudio?: string
  duration?: number // secondes
  error?: string
}

const ALLOWED_PROTOCOLS = new Set(['rtmp:', 'rtmps:', 'http:', 'https:', 'file:'])

/** Masque userinfo dans les logs (ne jamais logger credentials). */
export function redactProbeUrl(url: string): string {
  return url.replace(/:\/\/([^/@\s]+@)/g, '://***@')
}

/**
 * Valide l'URL avant passage à ffprobe (args séparés → pas d'injection shell,
 * mais on refuse les schémas / formes dangereuses).
 */
export function assertSafeProbeUrl(raw: string): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) {
    throw new Error('Invalid probe URL')
  }
  // Caractères de contrôle / null
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(raw)) {
    throw new Error('Invalid probe URL')
  }

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error('Invalid probe URL')
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error('Invalid probe URL scheme')
  }

  // file: uniquement chemin absolu local (sondes HLS locales existantes)
  if (parsed.protocol === 'file:') {
    // Rejeter file://hostname/... (hors localhost déjà normalisé par URL)
    if (parsed.host && parsed.host !== 'localhost') {
      throw new Error('Invalid file probe path')
    }
    const p = parsed.pathname
    if (!p.startsWith('/') || p === '/' || p.includes('\0') || p.includes('..')) {
      throw new Error('Invalid file probe path')
    }
  }

  // Reconstruire une URL canonique (évite les formes bizarres)
  return parsed.toString()
}

function parseFfprobeJson(stdout: string): StreamMetrics | null {
  const data = JSON.parse(stdout)
  const metrics: StreamMetrics = {}

  if (data.streams && Array.isArray(data.streams)) {
    for (const stream of data.streams) {
      if (stream.codec_type === 'video') {
        if (stream.width && stream.height) {
          metrics.width = stream.width
          metrics.height = stream.height
          metrics.resolution = `${stream.width}x${stream.height}`
        }

        if (stream.r_frame_rate) {
          const [num, den] = stream.r_frame_rate.split('/').map(Number)
          if (den && den > 0) {
            metrics.framerate = Math.round((num / den) * 10) / 10
          }
        } else if (stream.avg_frame_rate) {
          const [num, den] = stream.avg_frame_rate.split('/').map(Number)
          if (den && den > 0) {
            metrics.framerate = Math.round((num / den) * 10) / 10
          }
        }

        if (stream.codec_name) {
          metrics.codecVideo = stream.codec_name.toUpperCase()
        }

        if (stream.bit_rate) {
          metrics.bitrateVideo = Math.round(Number(stream.bit_rate) / 1000)
        }
      } else if (stream.codec_type === 'audio') {
        if (stream.codec_name) {
          metrics.codecAudio = stream.codec_name.toUpperCase()
        }
        if (stream.bit_rate) {
          metrics.bitrateAudio = Math.round(Number(stream.bit_rate) / 1000)
        }
      }
    }
  }

  if (data.format && data.format.bit_rate) {
    const totalBitrate = Math.round(Number(data.format.bit_rate) / 1000)
    if (!metrics.bitrateVideo && metrics.bitrateAudio) {
      metrics.bitrateVideo = Math.max(0, totalBitrate - metrics.bitrateAudio)
    } else if (!metrics.bitrateVideo) {
      metrics.bitrateVideo = totalBitrate
    }
  }

  if (data.format && data.format.duration) {
    metrics.duration = parseFloat(data.format.duration)
  }

  return Object.keys(metrics).length > 0 ? metrics : null
}

/**
 * Exécute ffprobe sur une URL RTMP/HLS et retourne les métriques.
 * @param probeUrl URL (rtmp/rtmps/http/https/file absolu)
 * @param timeout Timeout en millisecondes (défaut: 5000ms)
 */
export async function getStreamMetrics(
  probeUrl: string,
  timeout: number = 5000
): Promise<StreamMetrics | null> {
  let safeUrl: string
  try {
    safeUrl = assertSafeProbeUrl(probeUrl)
  } catch {
    return null
  }

  const timeoutMs = Math.max(1_000, Math.min(timeout, 60_000))

  try {
    const { stdout, stderr, code } = await spawnCapture(
      'ffprobe',
      ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', safeUrl],
      { timeoutMs, maxBuffer: 2 * 1024 * 1024 }
    )

    const errText = stderr || ''
    if (
      errText.includes('Connection refused') ||
      errText.includes('No route to host')
    ) {
      return null
    }

    if (code !== 0 && !stdout.trim()) {
      return null
    }

    try {
      return parseFfprobeJson(stdout)
    } catch {
      return null
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      !message.includes('timeout') &&
      !message.includes('Connection refused') &&
      !message.includes('No route to host') &&
      !message.includes('SIGTERM')
    ) {
      console.error(`Erreur ffprobe pour ${redactProbeUrl(safeUrl)}:`, message)
    }
    return null
  }
}
