/**
 * Matrice de permissions par rôle, au-dessus de l'authentification globale
 * (lib/require-auth.ts vérifie "connecté avec un rôle valide" ; requireRole
 * vérifie en plus que ce rôle a le droit de faire cette action précise).
 *
 * Un seul compte existe aujourd'hui (super_admin) — cette matrice prépare le
 * terrain pour une future gestion multi-comptes sans rien changer au
 * comportement observable tant qu'il n'y a qu'un compte.
 */

import type { NextRequest } from 'next/server'
import { isRole, type Role } from '@/lib/jwt'
import { requireAuth, unauthorizedJson, type AuthFail, type AuthOk } from '@/lib/require-auth'

export type Action =
  | 'stream:restart'
  | 'stream:create'
  | 'stream:update'
  | 'stream:delete'
  | 'stream:rollback'
  | 'srs:kick'
  | 'srs:reload'
  | 'system:cleanup'
  | 'recording:start'
  | 'recording:stop'
  | 'recording:delete'

const OPERATOR_ACTIONS: readonly Action[] = [
  'stream:restart',
  'srs:kick',
  'recording:start',
  'recording:stop',
]

const ADMIN_ACTIONS: readonly Action[] = [
  ...OPERATOR_ACTIONS,
  'stream:create',
  'stream:update',
  'stream:delete',
  'stream:rollback',
  'srs:reload',
  'recording:delete',
  'system:cleanup',
]

const PERMISSIONS: Record<Role, ReadonlySet<Action>> = {
  viewer: new Set(),
  operator: new Set(OPERATOR_ACTIONS),
  admin: new Set(ADMIN_ACTIONS),
  super_admin: new Set(ADMIN_ACTIONS),
}

export function hasPermission(role: Role, action: Action): boolean {
  return PERMISSIONS[role].has(action)
}

/**
 * Remplacement direct de `requireAuth` pour les routes destructives : mêmes
 * types de retour (`AuthOk | AuthFail`), ajoute juste le contrôle de
 * permission par rôle. 403 (pas 401) si authentifié mais rôle insuffisant.
 */
export function requireRole(action: Action) {
  return async (request: NextRequest | Request): Promise<AuthOk | AuthFail> => {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth
    const role = auth.payload.role
    if (!isRole(role) || !hasPermission(role, action)) {
      return { ok: false, response: unauthorizedJson('Forbidden', 403) }
    }
    return auth
  }
}
