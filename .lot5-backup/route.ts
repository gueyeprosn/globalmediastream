import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_TOKEN_COOKIE } from '@/lib/auth-cookie'
import { verifyAdminPassword } from '@/lib/admin-auth'
import { signAdminToken } from '@/lib/jwt'
import { logError } from '@/lib/logger'
import {
  clientIpFromRequest,
  isLoginBlocked,
  recordLoginFailure,
  recordLoginSuccess,
} from '@/lib/login-rate-limit'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const ip = clientIpFromRequest(request)
    if (isLoginBlocked(ip)) {
      return NextResponse.json(
        { error: 'Trop de tentatives, réessayez dans quelques minutes.' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const password = typeof body?.password === 'string' ? body.password : ''
    const ok = await verifyAdminPassword(password)
    if (!ok) {
      if (recordLoginFailure(ip)) {
        return NextResponse.json(
          { error: 'Trop de tentatives, réessayez dans quelques minutes.' },
          { status: 429 }
        )
      }
      return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 })
    }

    recordLoginSuccess(ip)
    const token = await signAdminToken()
    const res = NextResponse.json({ token, expiresIn: 86400 })
    const secure = process.env.NODE_ENV === 'production'
    res.cookies.set(ADMIN_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 86400,
      path: '/',
    })
    return res
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    logError(request, 'auth/login', msg)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
