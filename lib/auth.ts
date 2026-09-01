// Auth client : cookie httpOnly `admin_token` (pas de JWT en sessionStorage).

const AUTH_KEY = 'stream-manager-auth'
/** Legacy — nettoyé au login / checkSession ; ne plus utiliser. */
const AUTH_TOKEN_KEY = 'stream-manager-token'

export interface AuthUser {
  username: string
  loginTime: number
}

function clearLegacyToken() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(AUTH_TOKEN_KEY)
}

function setLocalSessionFlag() {
  if (typeof window === 'undefined') return
  const user: AuthUser = { username: 'admin', loginTime: Date.now() }
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(user))
  clearLegacyToken()
}

function clearLocalSessionFlag() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(AUTH_KEY)
  clearLegacyToken()
}

/** Vérifie le cookie via GET /api/auth/session (source de vérité). */
export async function checkSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    const res = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })
    if (!res.ok) {
      clearLocalSessionFlag()
      return false
    }
    const data = await res.json().catch(() => ({}))
    if (data?.ok === true) {
      setLocalSessionFlag()
      return true
    }
    clearLocalSessionFlag()
    return false
  } catch {
    clearLocalSessionFlag()
    return false
  }
}

export async function login(password: string): Promise<boolean> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    credentials: 'include',
  })
  if (!res.ok) {
    clearLocalSessionFlag()
    return false
  }
  const data = await res.json().catch(() => ({}))
  if (data?.ok !== true) {
    clearLocalSessionFlag()
    return false
  }
  setLocalSessionFlag()
  return true
}

export function logout(): void {
  if (typeof window === 'undefined') return
  clearLocalSessionFlag()
  void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
}

/**
 * Indicateur local synchrone (UX). Toujours confirmer avec checkSession() pour les gardes.
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  clearLegacyToken()
  const auth = sessionStorage.getItem(AUTH_KEY)
  if (!auth) return false
  try {
    const user: AuthUser = JSON.parse(auth)
    const maxAge = 24 * 60 * 60 * 1000
    if (Date.now() - user.loginTime > maxAge) {
      clearLocalSessionFlag()
      return false
    }
    return true
  } catch {
    return false
  }
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const auth = sessionStorage.getItem(AUTH_KEY)
  if (!auth) return null
  try {
    return JSON.parse(auth)
  } catch {
    return null
  }
}

/** @deprecated Cookie-only — toujours null. */
export function getAuthToken(): string | null {
  clearLegacyToken()
  return null
}
