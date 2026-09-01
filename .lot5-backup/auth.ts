// Authentification : JWT émis par POST /api/auth/login, stocké côté client.

const AUTH_KEY = 'stream-manager-auth'
const AUTH_TOKEN_KEY = 'stream-manager-token'

export interface AuthUser {
  username: string
  loginTime: number
}

function parseJwtExp(token: string): number | null {
  try {
    const p = token.split('.')[1]
    const json = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.exp === 'number' ? json.exp : null
  } catch {
    return null
  }
}

export async function login(password: string): Promise<boolean> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    credentials: 'include',
  })
  if (!res.ok) return false
  const data = await res.json().catch(() => ({}))
  if (typeof data?.token !== 'string' || !data.token) return false

  if (typeof window !== 'undefined') {
    const user: AuthUser = {
      username: 'admin',
      loginTime: Date.now(),
    }
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(user))
    sessionStorage.setItem(AUTH_TOKEN_KEY, data.token)
  }
  return true
}

export function logout(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(AUTH_KEY)
    sessionStorage.removeItem(AUTH_TOKEN_KEY)
    void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false

  const auth = sessionStorage.getItem(AUTH_KEY)
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY)

  if (!auth || !token) return false

  const exp = parseJwtExp(token)
  if (exp !== null && exp * 1000 < Date.now()) {
    logout()
    return false
  }

  try {
    const user: AuthUser = JSON.parse(auth)
    const maxAge = 24 * 60 * 60 * 1000
    if (Date.now() - user.loginTime > maxAge) {
      logout()
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

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}
