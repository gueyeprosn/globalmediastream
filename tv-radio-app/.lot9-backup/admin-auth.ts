import bcrypt from 'bcryptjs'

/**
 * Vérifie le mot de passe admin.
 * Préférer ADMIN_PASSWORD_HASH (bcrypt) ; ADMIN_PASSWORD sert de repli migration.
 */
export async function verifyAdminPassword(plain: string): Promise<boolean> {
  if (!plain || plain.length === 0) return false
  const hash = process.env.ADMIN_PASSWORD_HASH
  const legacy = process.env.ADMIN_PASSWORD
  if (hash) {
    try {
      return await bcrypt.compare(plain, hash)
    } catch {
      return false
    }
  }
  if (legacy) {
    return plain === legacy
  }
  return false
}
