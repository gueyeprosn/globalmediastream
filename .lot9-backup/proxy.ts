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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith('/api/')) {
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
  matcher: ['/api/:path*'],
}
