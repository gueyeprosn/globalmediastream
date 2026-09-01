import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertSafeStreamRouteId } from '@/lib/safe-shell'

const MAX_VERSIONS = 5
const HISTORY_DIR = path.join(process.cwd(), 'data', 'stream-history')

export type StreamHistoryKind = 'rtmp' | 'srt'

export type StreamHistoryEntry = {
  savedAt: string
  kind: StreamHistoryKind
  registry: Record<string, unknown>
}

export async function pushStreamHistory(
  id: string,
  kind: StreamHistoryKind,
  registry: Record<string, unknown>
): Promise<void> {
  assertSafeStreamRouteId(id)
  await mkdir(HISTORY_DIR, { recursive: true })
  const filePath = path.join(HISTORY_DIR, `${id}.json`)

  let entries: StreamHistoryEntry[] = []
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) entries = parsed
  } catch {
    /* new file */
  }

  entries.unshift({
    savedAt: new Date().toISOString(),
    kind,
    registry,
  })

  if (entries.length > MAX_VERSIONS) {
    entries = entries.slice(0, MAX_VERSIONS)
  }

  await writeFile(filePath, JSON.stringify(entries, null, 2), 'utf8')
}

export async function listStreamHistory(id: string): Promise<StreamHistoryEntry[]> {
  assertSafeStreamRouteId(id)
  const filePath = path.join(HISTORY_DIR, `${id}.json`)
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function getStreamHistoryVersion(
  id: string,
  versionIndex = 1
): Promise<StreamHistoryEntry | null> {
  const entries = await listStreamHistory(id)
  return entries[versionIndex] ?? null
}
