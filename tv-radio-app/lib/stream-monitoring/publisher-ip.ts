/**
 * Utilitaire pour récupérer l'IP de l'expéditeur (publisher) d'un flux RTMP
 */

import {
  assertSafeListenPort,
  captureSsTcp,
  parseSsEstablishedRemoteIps,
  readProcessComm,
} from "@/lib/host-metrics"

/**
 * Récupère l'IP du publisher pour un port RTMP donné
 */
export async function getPublisherIP(
  port: number,
  streamName?: string
): Promise<string | null> {
  try {
    const p = assertSafeListenPort(port)
    const stdout = await captureSsTcp()
    if (!stdout.trim()) return null

    const lines = stdout.split("\n").filter((line) => {
      if (!line.includes(`:${p}`)) return false
      return line.includes("ESTAB") || line.includes("ESTABLISHED")
    })

    for (const line of lines) {
      const matches = [...line.matchAll(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+/g)]
      for (const m of matches) {
        const ip = m[1]
        if (ip === "127.0.0.1" || ip === "0.0.0.0") continue

        if (streamName) {
          const processMatch =
            line.match(/\(\(.*?pid=(\d+)/) || line.match(/\/(\d+)\//)
          if (processMatch) {
            const comm = (await readProcessComm(processMatch[1])).toLowerCase()
            const needle = streamName.toLowerCase()
            if (
              comm.includes(needle) ||
              comm.includes("ffmpeg") ||
              comm.includes("rtmp")
            ) {
              return ip
            }
          }
          continue
        }

        return ip
      }
    }

    if (streamName) return null
    const all = parseSsEstablishedRemoteIps(stdout, p)
    return all[0] || null
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`Erreur IP publisher port ${port}:`, msg)
    return null
  }
}

/**
 * Récupère toutes les IPs connectées à un port RTMP
 */
export async function getAllConnectedIPs(port: number): Promise<string[]> {
  try {
    const p = assertSafeListenPort(port)
    const stdout = await captureSsTcp()
    return parseSsEstablishedRemoteIps(stdout, p)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`Erreur IPs port ${port}:`, msg)
    return []
  }
}
