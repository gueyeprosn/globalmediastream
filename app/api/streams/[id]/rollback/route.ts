import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { getSrtStreamsRegistryPath } from '@/lib/paths'
import { requireAuth } from '@/lib/require-auth'
import {
  assertSafeStreamRouteId,
  assertSafeSystemdUnit,
  systemctlAction,
  systemctlDaemonReload,
} from '@/lib/safe-shell'
import { getStreamHistoryVersion } from '@/lib/stream-history'

const RTMP_STREAMS_FILE = process.env.RTMP_STREAMS_REGISTRY_PATH || '/srv/rtmp-streams.json'

export async function POST(request: Request,
  { params }: { params: Promise<{ id: string }> }){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
    const { id } = await params
    assertSafeStreamRouteId(id)

    const body = (await request.json().catch(() => ({}))) as { versionIndex?: number }
    const versionIndex = Number.isFinite(body.versionIndex) ? Number(body.versionIndex) : 1

    const snapshot = await getStreamHistoryVersion(id, versionIndex)
    if (!snapshot) {
      return NextResponse.json({ error: 'Aucune version précédente disponible' }, { status: 404 })
    }

    const registry = snapshot.registry as {
      id: string
      service?: string
      name?: string
      inputPort?: number
      outputPort?: number
      streamKey?: string
      hlsUrl?: string
      outputPorts?: number[]
      createdAt?: string
      updatedAt?: string
    }

    if (snapshot.kind === 'rtmp') {
      let streams: Array<Record<string, unknown>> = []
      if (existsSync(RTMP_STREAMS_FILE)) {
        streams = JSON.parse(await readFile(RTMP_STREAMS_FILE, 'utf8'))
      }
      const idx = streams.findIndex((s) => s.id === id)
      const now = new Date().toISOString()
      const restored = { ...registry, id, updatedAt: now }
      if (idx >= 0) streams[idx] = restored
      else streams.push(restored)
      await writeFile(RTMP_STREAMS_FILE, JSON.stringify(streams, null, 2))
    } else {
      const srtFile = getSrtStreamsRegistryPath()
      let streams: Array<Record<string, unknown>> = []
      if (existsSync(srtFile)) {
        streams = JSON.parse(await readFile(srtFile, 'utf8'))
      }
      const idx = streams.findIndex((s) => s.id === id)
      const now = new Date().toISOString()
      const restored = { ...registry, id, updatedAt: now }
      if (idx >= 0) streams[idx] = restored
      else streams.push(restored)
      await writeFile(srtFile, JSON.stringify(streams, null, 2))
    }

    if (registry.service && registry.service !== 'srs-native-7000') {
      const unit = assertSafeSystemdUnit(
        registry.service.endsWith('.service') ? registry.service : `${registry.service}.service`
      )
      await systemctlDaemonReload()
      await systemctlAction('restart', unit)
    }

    return NextResponse.json({
      success: true,
      id,
      restoredAt: snapshot.savedAt,
      kind: snapshot.kind,
      message: 'Configuration restaurée depuis l’historique',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Rollback impossible'
    if (message === 'Invalid stream id') {
      return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
