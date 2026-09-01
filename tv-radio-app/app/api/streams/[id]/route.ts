import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import {
  assertSafeStreamRouteId,
  assertSafeSystemdUnit,
  isSafeSystemdUnit,
  journalctlUnitLogs,
  psAuxFirstLineContaining,
  systemctlAction,
  systemctlIsActive,
  systemctlShowLoadState,
} from '@/lib/safe-shell'

/** Unités systemd créées par le dashboard RTMP : rtmp-&lt;id&gt;.service */
async function resolveServiceUnit(id: string): Promise<string | null> {
  assertSafeStreamRouteId(id)
  if (id.includes('rtmp-output')) {
    const base = id.replace('-rtmp-output', '')
    assertSafeStreamRouteId(base)
    const unit = `${base}-rtmp-output.service`
    return isSafeSystemdUnit(unit) && (await serviceExists(unit)) ? unit : null
  }
  if (id.startsWith('rtmp-')) {
    const n = `${id}.service`
    return isSafeSystemdUnit(n) && (await serviceExists(n)) ? n : null
  }
  const rtmpPrefixed = `rtmp-${id}.service`
  if (await serviceExists(rtmpPrefixed)) return rtmpPrefixed
  const plain = `${id}.service`
  if (await serviceExists(plain)) return plain
  return null
}

async function serviceExists(serviceName: string): Promise<boolean> {
  if (!isSafeSystemdUnit(serviceName)) return false
  try {
    const loadState = await systemctlShowLoadState(serviceName)
    return loadState !== '' && loadState !== 'not-found'
  } catch {
    return false
  }
}

export async function GET(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
    const { id } = await params
    assertSafeStreamRouteId(id)

    const serviceName = await resolveServiceUnit(id)
    if (!serviceName) {
      return NextResponse.json({ error: 'Service non trouvé' }, { status: 404 })
    }

    const u = assertSafeSystemdUnit(serviceName)
    const status = (await systemctlIsActive(u)).trim().split('\n')[0] || 'inactive'

    const logsOut = await journalctlUnitLogs(u, 50)
    const logs = logsOut.trim().split('\n').filter((line) => line.trim())

    const psOut = await psAuxFirstLineContaining(u)
    let cpu = 0
    let memory = '0 MB'
    if (psOut.trim()) {
      const parts = psOut.trim().split(/\s+/)
      cpu = parseFloat(parts[2]) || 0
      memory = `${parseFloat(parts[3]) || 0} MB`
    }

    return NextResponse.json({
      id,
      service: serviceName,
      status,
      logs,
      cpu,
      memory,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Invalid stream id') {
      return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 })
    }
    return NextResponse.json(
      { error: err.message || 'Erreur lors de la récupération du flux' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
    const { id } = await params
    assertSafeStreamRouteId(id)
    const body = await request.json()
    const { action } = body

    if (!['start', 'stop', 'restart'].includes(action)) {
      return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
    }

    const serviceName = await resolveServiceUnit(id)
    if (!serviceName) {
      return NextResponse.json({ error: `Aucune unité systemd pour l'id « ${id} »` }, { status: 404 })
    }

    const u = assertSafeSystemdUnit(serviceName)
    await systemctlAction(action as 'start' | 'stop' | 'restart', u)

    await new Promise((resolve) => setTimeout(resolve, 1000))

    const status = (await systemctlIsActive(u)).trim().split('\n')[0] || 'inactive'

    return NextResponse.json({
      id,
      service: serviceName,
      action,
      status,
      success: true,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Invalid stream id') {
      return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 })
    }
    return NextResponse.json(
      { error: err.message || "Erreur lors de l'exécution de l'action" },
      { status: 500 }
    )
  }
}
