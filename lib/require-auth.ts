/**
 * Défense en profondeur : vérifie JWT (cookie ou Bearer) + role admin.
 * À appeler en tête des route handlers — ne remplace pas proxy.ts.
 */

import { NextRequest, NextResponse } from 'next/server'
import type { JWTPayload } from 'jose'
import { ADMIN_TOKEN_COOKIE } from '@/lib/auth-cookie'
import { verifyAdminToken } from '@/lib/jwt'

export type AuthOk = { ok: true; payload: JWTPayload; token: string }
export type AuthFail = { ok: false; response: NextResponse }

export function unauthorizedJson(message = 'Unauthorized', status = 401): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

export function extractBearerOrCookieToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ') && auth.length > 7) {
    return auth.slice(7).trim() || null
  }
  const cookie = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value
  return cookie?.trim() || null
}

export async function requireAuth(request: NextRequest | Request): Promise<AuthOk | AuthFail> {
  let token: string | null = null
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ') && auth.length > 7) {
    token = auth.slice(7).trim() || null
  }
  if (!token) {
    if ('cookies' in request && typeof (request as NextRequest).cookies?.get === 'function') {
      token = (request as NextRequest).cookies.get(ADMIN_TOKEN_COOKIE)?.value?.trim() || null
    } else {
      const raw = request.headers.get('cookie') || ''
      const m = raw.match(new RegExp(`(?:^|;\\s*)${ADMIN_TOKEN_COOKIE}=([^;]*)`))
      token = m?.[1] ? decodeURIComponent(m[1].trim()) : null
    }
  }
  if (!token) {
    return { ok: false, response: unauthorizedJson() }
  }

  try {
    const payload = await verifyAdminToken(token)
    if (payload.role !== 'admin') {
      return { ok: false, response: unauthorizedJson() }
    }
    return { ok: true, payload, token }
  } catch {
    return { ok: false, response: unauthorizedJson() }
  }
}
