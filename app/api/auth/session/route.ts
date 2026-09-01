import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

export const runtime = 'nodejs'

/**
 * Vérifie la session admin via cookie httpOnly (ou Bearer legacy).
 * Protégé aussi par proxy.ts — double contrôle volontaire.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const exp = typeof auth.payload.exp === 'number' ? auth.payload.exp : null
  return NextResponse.json({
    ok: true,
    role: 'admin',
    expiresIn: exp != null ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : null,
  })
}
