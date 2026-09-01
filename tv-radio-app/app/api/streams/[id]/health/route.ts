import { NextRequest, NextResponse } from 'next/server'
import { evaluateStreamHealth } from '@/lib/stream-health'
import { requireAuth } from '@/lib/require-auth'

export async function GET(request: Request,
  { params }: { params: Promise<{ id: string }> }){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
    const { id } = await params
    const report = await evaluateStreamHealth(id)
    return NextResponse.json(report, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur santé flux'
    if (message === 'Invalid stream id') {
      return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
