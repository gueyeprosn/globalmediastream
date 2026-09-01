/**
 * Vérifie le mot de passe admin.
 * Obligatoire en production : ADMIN_PASSWORD_HASH (bcrypt).
 * ADMIN_PASSWORD en clair : uniquement hors production (migration / dev).
 */

import bcrypt from 'bcryptjs'

export async function verifyAdminPassword(plain: string): Promise<boolean> {
  if (!plain || plain.length === 0) return false
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim()
  if (hash) {
    try {
      return await bcrypt.compare(plain, hash)
    } catch {
      return false
    }
  }
  const legacy = process.env.ADMIN_PASSWORD
  if (legacy && process.env.NODE_ENV !== 'production') {
    return plain === legacy
  }
  return false
}
