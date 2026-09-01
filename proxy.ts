import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import * as jose from 'jose'
import { ADMIN_TOKEN_COOKIE } from '@/lib/auth-cookie'
import { getJwtSecretBytes } from '@/lib/jwt-secret'

function forwardRequestId(request: NextRequest, id: string) {
  const reqHeaders = new Headers(request.headers)
  reqHeaders.set('x-request-id', id)
  return reqHeaders
}

function withRequestId(response: NextResponse, id: string) {
  response.headers.set('x-request-id', id)
  return response
}

function isPublicPage(pathname: string): boolean {
  if (pathname === '/login') return true
  if (pathname === '/watch' || pathname.startsWith('/watch/')) return true
  return false
}

function isPublicAsset(pathname: string): boolean {
  if (pathname.startsWith('/_next/')) return true
  if (pathname === '/favicon.ico' || pathname === '/icon.svg') return true
  return /\.(?:ico|png|jpg|jpeg|gif|svg|webp|css|js|map|txt|xml|woff2?)$/i.test(pathname)
}

async function requireAdminCookie(
  request: NextRequest
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  let secret: Uint8Array
  try {
    secret = getJwtSecretBytes()
  } catch {
    return {
      ok: false,
      response: NextResponse.redirect(new URL('/login', request.url)),
    }
  }
  const token = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value
  if (!token) {
    return {
      ok: false,
      response: NextResponse.redirect(new URL('/login', request.url)),
    }
  }
  try {
    const { payload } = await jose.jwtVerify(token, secret)
    if (payload.role !== 'admin') {
      return {
        ok: false,
        response: NextResponse.redirect(new URL('/login', request.url)),
      }
    }
    return { ok: true }
  } catch {
    return {
      ok: false,
      response: NextResponse.redirect(new URL('/login', request.url)),
    }
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicAsset(pathname)) {
    return NextResponse.next()
  }

  // Pages HTML : redirect serveur si pas de session (sauf login / watch)
  if (!pathname.startsWith('/api/')) {
    if (isPublicPage(pathname)) {
      return NextResponse.next()
    }
    const gate = await requireAdminCookie(request)
    if (!gate.ok) return gate.response
    return NextResponse.next()
  }

  const requestId =
    request.headers.get('x-request-id')?.trim() || crypto.randomUUID()
  const reqHeaders = forwardRequestId(request, requestId)

  if (pathname === '/api/auth/login' && request.method === 'POST') {
    return withRequestId(
      NextResponse.next({ request: { headers: reqHeaders } }),
      requestId
    )
  }

  if (pathname === '/api/auth/logout' && request.method === 'POST') {
    return withRequestId(
      NextResponse.next({ request: { headers: reqHeaders } }),
      requestId
    )
  }

  let secret: Uint8Array
  try {
    secret = getJwtSecretBytes()
  } catch {
    return withRequestId(
      NextResponse.json({ error: 'Server misconfigured' }, { status: 503 }),
      requestId
    )
  }

  const auth = request.headers.get('authorization')
  const cookieToken = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value
  const rawToken = auth?.startsWith('Bearer ') ? auth.slice(7) : cookieToken

  if (!rawToken) {
    return withRequestId(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      requestId
    )
  }

  try {
    const { payload } = await jose.jwtVerify(rawToken, secret)
    if (payload.role !== 'admin') {
      return withRequestId(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        requestId
      )
    }
    return withRequestId(
      NextResponse.next({ request: { headers: reqHeaders } }),
      requestId
    )
  } catch {
    return withRequestId(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      requestId
    )
  }
}

export const config = {
  matcher: [
    /*
     * Pages + API, hors assets Next / fichiers statiques courants.
     */
    '/((?!_next/static|_next/image).*)',
  ],
}
