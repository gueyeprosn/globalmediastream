import { NextResponse } from 'next/server'
import { ADMIN_TOKEN_COOKIE } from '@/lib/auth-cookie'

export const runtime = 'nodejs'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  const secure = process.env.NODE_ENV === 'production'
  res.cookies.set(ADMIN_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
