import * as jose from 'jose'
import { getJwtSecretBytes } from '@/lib/jwt-secret'

export async function signAdminToken(): Promise<string> {
  return await new jose.SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getJwtSecretBytes())
}

export async function verifyAdminToken(token: string): Promise<jose.JWTPayload> {
  const { payload } = await jose.jwtVerify(token, getJwtSecretBytes())
  return payload
}
