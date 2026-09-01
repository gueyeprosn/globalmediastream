import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { getSrtStreamsRegistryPath } from '@/lib/paths'
import { requireRole } from '@/lib/rbac'
import {
  assertSafeStreamRouteId,
  assertSafeSystemdUnit,
  assertSrtScriptPath,
  assertTcpUdpPort,
  systemctlDaemonReload,
  systemctlDisable,
  systemctlStop,
  ufwDeleteAllowUdpQuiet,
} from '@/lib/safe-shell'

const SRT_STREAMS_FILE = getSrtStreamsRegistryPath()

interface SrtStreamRegistryItem {
  id: string
  name: string
  service: string
  inputPort: number
  outputPort?: number
  outputPorts?: number[]
  hlsUrl?: string
  createdAt: string
  updatedAt: string
}

async function getSrtStreamRegistry(): Promise<SrtStreamRegistryItem[]> {
  try {
    if (!existsSync(SRT_STREAMS_FILE)) return []
    const content = await readFile(SRT_STREAMS_FILE, 'utf-8')
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function saveSrtStreamRegistry(streams: SrtStreamRegistryItem[]) {
  await writeFile(SRT_STREAMS_FILE, JSON.stringify(streams, null, 2))
}

export async function DELETE(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }){
  const __auth = await requireRole('stream:delete')(request)
  if (!__auth.ok) return __auth.response

  const { id } = await params
  try {
    assertSafeStreamRouteId(id)
    const streams = await getSrtStreamRegistry()
    const index = streams.findIndex((s) => s.id === id)
    if (index === -1) {
      return NextResponse.json({ error: 'Flux SRT non trouvé' }, { status: 404 })
    }

    const stream = streams[index]

    if (stream.service !== 'srs-native-7000') {
      const unit = assertSafeSystemdUnit(stream.service)
      await systemctlStop(unit).catch(() => {})
      await systemctlDisable(unit).catch(() => {})

      const scriptPath = assertSrtScriptPath(stream.id)
      const servicePath = `/etc/systemd/system/${unit}`

      try {
        await unlink(scriptPath)
      } catch {}

      try {
        await unlink(servicePath)
      } catch {}

      if (stream.inputPort) {
        await ufwDeleteAllowUdpQuiet(assertTcpUdpPort(stream.inputPort))
      }
      if (stream.outputPort) {
        await ufwDeleteAllowUdpQuiet(assertTcpUdpPort(stream.outputPort))
      }
      for (const p of stream.outputPorts || []) {
        if (p !== stream.outputPort) {
          await ufwDeleteAllowUdpQuiet(assertTcpUdpPort(p))
        }
      }

      await systemctlDaemonReload()
    }

    streams.splice(index, 1)
    await saveSrtStreamRegistry(streams)

    return NextResponse.json({
      success: true,
      message: 'Flux SRT retiré avec succès',
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    return NextResponse.json(
      { error: err.message || 'Erreur lors du retrait du flux SRT' },
      { status: 500 }
    )
  }
}
