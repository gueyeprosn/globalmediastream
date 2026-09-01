/**
 * Sources HLS enregistrables (FFmpeg -i <m3u8> -c copy).
 * Aligné sur les flux exposés par /api/streams (SRT + RTMP dynamiques + registry).
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { getSrtStreamsRegistryPath } from '@/lib/paths'

const PUBLIC_ORIGIN = (process.env.PUBLIC_STREAM_ORIGIN || 'https://stream.broadcastsn.com').replace(/\/$/, '')

const RTMP_STREAMS_FILE = process.env.RTMP_STREAMS_REGISTRY_PATH || '/srv/rtmp-streams.json'

export type RecordableSource = {
  id: string
  name: string
  type: 'srt' | 'rtmp'
  hlsUrl: string
  inputPort?: number
}

type RegistryItem = {
  id?: string
  name?: string
  inputPort?: number
  hlsUrl?: string
}

type RtmpFileItem = {
  id: string
  name?: string
  inputPort?: number
}

async function readSrtRegistry(): Promise<RegistryItem[]> {
  const p = getSrtStreamsRegistryPath()
  if (!existsSync(p)) return []
  try {
    const raw = await readFile(p, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as RegistryItem[]) : []
  } catch {
    return []
  }
}

async function readRtmpRegistry(): Promise<RtmpFileItem[]> {
  if (!existsSync(RTMP_STREAMS_FILE)) return []
  try {
    const raw = await readFile(RTMP_STREAMS_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as RtmpFileItem[]) : []
  } catch {
    return []
  }
}

/** Flux avec URL HLS publique connue (pas les relais SRT sans sortie HLS). */
export async function listRecordableHlsSources(): Promise<RecordableSource[]> {
  const byId = new Map<string, RecordableSource>()

  const add = (s: RecordableSource) => {
    if (!byId.has(s.id)) byId.set(s.id, s)
  }

  const staticSrt: RecordableSource[] = [
    {
      id: 'toubatv',
      name: 'Touba TV',
      type: 'srt',
      hlsUrl: `${PUBLIC_ORIGIN}/toubatv/index.m3u8`,
      inputPort: 6000,
    },
    {
      id: 'external-tv',
      name: 'External TV',
      type: 'srt',
      hlsUrl: `${PUBLIC_ORIGIN}/external-tv/index.m3u8`,
      inputPort: 6001,
    },
    {
      id: 'external-tv-2',
      name: 'External TV 2',
      type: 'srt',
      hlsUrl: `${PUBLIC_ORIGIN}/external-tv-2/index.m3u8`,
      inputPort: 6003,
    },
    {
      id: 'external-tv-3',
      name: 'External TV 3',
      type: 'srt',
      hlsUrl: `${PUBLIC_ORIGIN}/external-tv-3/index.m3u8`,
      inputPort: 6005,
    },
  ]
  staticSrt.forEach(add)

  const reg = await readSrtRegistry()
  for (const s of reg) {
    const id = s.id ? String(s.id) : ''
    if (!id || !s.hlsUrl) continue
    add({
      id,
      name: s.name ? String(s.name) : id,
      type: 'srt',
      hlsUrl: String(s.hlsUrl),
      inputPort: typeof s.inputPort === 'number' ? s.inputPort : undefined,
    })
  }

  const rtmpList = await readRtmpRegistry()
  for (const s of rtmpList) {
    if (!s?.id) continue
    add({
      id: String(s.id),
      name: s.name ? String(s.name) : String(s.id),
      type: 'rtmp',
      hlsUrl: `${PUBLIC_ORIGIN}/rtmp-hls/${s.id}/stream.m3u8`,
      inputPort: typeof s.inputPort === 'number' ? s.inputPort : undefined,
    })
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

/**
 * Si `RECORDINGS_FFMPEG_INPUT_ORIGIN` est défini (ex. `http://127.0.0.1`),
 * remplace l’origine publique pour que FFmpeg lise le HLS en local (évite TLS / DNS).
 */
export function rewriteHlsUrlForRecorderFfmpeg(publicUrl: string): string {
  const raw = process.env.RECORDINGS_FFMPEG_INPUT_ORIGIN?.trim()
  if (!raw) return publicUrl
  try {
    const u = new URL(publicUrl)
    const origin = raw.includes("://") ? raw : `http://${raw}`
    const o = new URL(origin)
    return `${o.origin}${u.pathname}${u.search}`
  } catch {
    return publicUrl
  }
}

export async function resolveHlsUrlForRecording(streamId: string): Promise<string | null> {
  const list = await listRecordableHlsSources()
  const hit = list.find((s) => s.id === streamId)
  if (!hit?.hlsUrl) return null
  return rewriteHlsUrlForRecorderFfmpeg(hit.hlsUrl)
}
