/**
 * Utilitaire pour exécuter ffprobe et extraire les métriques d'un flux RTMP
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

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

/**
 * Exécute ffprobe sur un flux RTMP et retourne les métriques
 * @param rtmpUrl URL RTMP (ex: rtmp://localhost:1935/live/stream-key)
 * @param timeout Timeout en millisecondes (défaut: 5000ms)
 * @returns Métriques du flux ou null si erreur
 */
export async function getStreamMetrics(
  rtmpUrl: string,
  timeout: number = 5000
): Promise<StreamMetrics | null> {
  try {
    // Commande ffprobe avec sortie JSON
    // Utiliser timeout système pour éviter les blocages
    const timeoutSeconds = Math.ceil(timeout / 1000)
    const command = `timeout ${timeoutSeconds} ffprobe -v quiet -print_format json -show_format -show_streams "${rtmpUrl}" 2>&1`
    
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      maxBuffer: 2 * 1024 * 1024,
    })

    if (
      stderr &&
      (stderr.includes('Connection refused') || stderr.includes('No route to host'))
    ) {
      return null
    }

    const data = JSON.parse(stdout)
    const metrics: StreamMetrics = {}

    // Parser les streams (vidéo et audio)
    if (data.streams && Array.isArray(data.streams)) {
      for (const stream of data.streams) {
        if (stream.codec_type === 'video') {
          // Résolution
          if (stream.width && stream.height) {
            metrics.width = stream.width
            metrics.height = stream.height
            metrics.resolution = `${stream.width}x${stream.height}`
          }

          // Framerate
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

          // Codec vidéo
          if (stream.codec_name) {
            metrics.codecVideo = stream.codec_name.toUpperCase()
          }

          // Bitrate vidéo
          if (stream.bit_rate) {
            metrics.bitrateVideo = Math.round(Number(stream.bit_rate) / 1000) // Convertir en kbps
          }
        } else if (stream.codec_type === 'audio') {
          // Codec audio
          if (stream.codec_name) {
            metrics.codecAudio = stream.codec_name.toUpperCase()
          }

          // Bitrate audio
          if (stream.bit_rate) {
            metrics.bitrateAudio = Math.round(Number(stream.bit_rate) / 1000) // Convertir en kbps
          }
        }
      }
    }

    // Bitrate total depuis format
    if (data.format && data.format.bit_rate) {
      const totalBitrate = Math.round(Number(data.format.bit_rate) / 1000)
      // Si bitrate vidéo non trouvé, utiliser le total moins l'audio
      if (!metrics.bitrateVideo && metrics.bitrateAudio) {
        metrics.bitrateVideo = Math.max(0, totalBitrate - metrics.bitrateAudio)
      } else if (!metrics.bitrateVideo) {
        metrics.bitrateVideo = totalBitrate
      }
    }

    // Duration
    if (data.format && data.format.duration) {
      metrics.duration = parseFloat(data.format.duration)
    }

    return Object.keys(metrics).length > 0 ? metrics : null
  } catch (error: any) {
    // Erreur de timeout ou flux non disponible
    if (error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM') {
      return null
    }
    
    // Erreur de parsing JSON (flux non valide)
    if (error.message && error.message.includes('Unexpected token')) {
      return null
    }

    // Ne pas logger les erreurs de timeout ou de connexion refusée (flux inactifs)
    // Ces erreurs sont normales et attendues
    if (!error.message?.includes('timeout') && !error.message?.includes('Connection refused') && !error.message?.includes('No route to host')) {
      console.error(`Erreur ffprobe pour ${rtmpUrl}:`, error.message)
    }
    return null
  }
}
