import { getHlsViewerDetailForStreams, type HlsViewerDetail } from '@/lib/monitoring/hls-viewers'

export type { HlsViewerDetail }

/** Détail viewers HLS pour les flux listés (une passe logs + GeoIP). */
export async function collectHlsViewerDetails(
  streamIds: string[]
): Promise<Map<string, HlsViewerDetail>> {
  return getHlsViewerDetailForStreams(streamIds)
}
