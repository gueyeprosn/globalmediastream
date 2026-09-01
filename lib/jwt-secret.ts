/** Clé HMAC partagée pour JWT (middleware + routes). */
export function getJwtSecretBytes(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production')
    }
    return new TextEncoder().encode('dev-insecure-jwt-secret-change-me')
  }
  if (process.env.NODE_ENV === 'production' && s.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production')
  }
  return new TextEncoder().encode(s)
}
