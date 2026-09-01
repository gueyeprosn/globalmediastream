import maxmind from 'maxmind'
import type { Reader } from 'maxmind'
import type { CountryResponse } from 'mmdb-lib'

let reader: Reader<CountryResponse> | null | undefined

function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:/i, '').trim()
}

/**
 * Résout une IP vers un code pays ISO (GeoLite2 Country).
 * Requiert GEOLITE2_COUNTRY_PATH pointant vers le fichier .mmdb.
 */
export async function countryForIp(ip: string): Promise<string | null> {
  const path = process.env.GEOLITE2_COUNTRY_PATH
  if (!path || !ip) return null
  const clean = normalizeIp(ip)
  if (reader === undefined) {
    try {
      reader = await maxmind.open<CountryResponse>(path)
    } catch {
      reader = null
    }
  }
  if (!reader) return null
  try {
    const rec = reader.get(clean)
    return rec?.country?.iso_code ?? null
  } catch {
    return null
  }
}
