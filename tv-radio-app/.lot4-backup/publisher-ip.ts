/**
 * Utilitaire pour récupérer l'IP de l'expéditeur (publisher) d'un flux RTMP
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Récupère l'IP du publisher pour un port RTMP donné
 * @param port Port RTMP (ex: 1935)
 * @param streamName Nom du stream (optionnel, pour filtrage)
 * @returns IP du publisher ou null si non trouvé
 */
export async function getPublisherIP(
  port: number,
  streamName?: string
): Promise<string | null> {
  try {
    // Utiliser ss (plus moderne) ou netstat en fallback
    let command = `ss -tnp 2>/dev/null | grep ":${port}" || netstat -tnp 2>/dev/null | grep ":${port}" || echo ""`
    
    const { stdout } = await execAsync(command)
    
    if (!stdout.trim()) {
      return null
    }

    // Parser les lignes de connexion
    // Format ss: ESTAB 0 0 192.168.1.1:12345 10.0.0.1:1935 users:(("ffmpeg",pid=1234,fd=3))
    // Format netstat: tcp 0 0 192.168.1.1:12345 10.0.0.1:1935 ESTABLISHED 1234/ffmpeg
    
    const lines = stdout.trim().split('\n')
    
    for (const line of lines) {
      // Chercher les connexions ESTABLISHED (actives)
      if (!line.includes('ESTAB') && !line.includes('ESTABLISHED')) {
        continue
      }

      // Extraire l'IP source (première IP dans la ligne)
      // Pattern: IP:PORT -> IP:PORT
      const ipMatch = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+/)
      
      if (ipMatch) {
        const ip = ipMatch[1]
        
        // Ignorer localhost/127.0.0.1 (connexions internes)
        if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
          continue
        }

        // Si streamName fourni, vérifier que le processus correspond
        if (streamName) {
          const processMatch = line.match(/\(\(.*?pid=(\d+)/) || line.match(/\/(\d+)\//)
          if (processMatch) {
            // Vérifier si le processus correspond au service du stream
            try {
              const pid = processMatch[1]
              const { stdout: psOut } = await execAsync(`ps -p ${pid} -o comm= 2>/dev/null || echo ""`)
              if (psOut.toLowerCase().includes(streamName.toLowerCase()) || 
                  psOut.toLowerCase().includes('ffmpeg') ||
                  psOut.toLowerCase().includes('rtmp')) {
                return ip
              }
            } catch {
              // Continuer si erreur
            }
          }
        } else {
          // Retourner la première IP valide trouvée
          return ip
        }
      }
    }

    return null
  } catch (error: any) {
    console.error(`Erreur lors de la récupération de l'IP publisher pour le port ${port}:`, error.message)
    return null
  }
}

/**
 * Récupère toutes les IPs connectées à un port RTMP
 * @param port Port RTMP
 * @returns Liste des IPs connectées
 */
export async function getAllConnectedIPs(port: number): Promise<string[]> {
  try {
    const command = `ss -tnp 2>/dev/null | grep ":${port}" | grep ESTAB || netstat -tnp 2>/dev/null | grep ":${port}" | grep ESTABLISHED || echo ""`
    
    const { stdout } = await execAsync(command)
    
    if (!stdout.trim()) {
      return []
    }

    const ips = new Set<string>()
    const lines = stdout.trim().split('\n')

    for (const line of lines) {
      const ipMatch = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+/)
      if (ipMatch) {
        const ip = ipMatch[1]
        if (ip !== '127.0.0.1' && ip !== '::1') {
          ips.add(ip)
        }
      }
    }

    return Array.from(ips)
  } catch (error: any) {
    console.error(`Erreur lors de la récupération des IPs pour le port ${port}:`, error.message)
    return []
  }
}
