import * as jose from 'jose'
import { getJwtSecretBytes } from '@/lib/jwt-secret'

/**
 * RBAC : rôles ordonnés du plus large au plus restreint. Un seul compte
 * (super_admin) existe en pratique aujourd'hui — voir lib/rbac.ts pour la
 * matrice de permissions par rôle.
 */
export const ROLES = ['super_admin', 'admin', 'operator', 'viewer'] as const
export type Role = (typeof ROLES)[number]

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export async function signUserToken(params: { sub: string; role: Role }): Promise<string> {
  return await new jose.SignJWT({ role: params.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(params.sub)
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getJwtSecretBytes())
}

/** Compat : le compte admin unique actuel devient super_admin. */
export async function signAdminToken(): Promise<string> {
  return signUserToken({ sub: 'admin', role: 'super_admin' })
}

export async function verifyAdminToken(token: string): Promise<jose.JWTPayload> {
  const { payload } = await jose.jwtVerify(token, getJwtSecretBytes())
  return payload
}
