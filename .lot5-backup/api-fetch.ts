const TOKEN_KEY = 'stream-manager-token'

/** Headers Authorization pour appels API depuis le navigateur (après login). */
export function apiAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {}
  const t = sessionStorage.getItem(TOKEN_KEY)
  return t ? { Authorization: `Bearer ${t}` } : {}
}

/** fetch vers /api/* avec jeton JWT si présent. */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? undefined)
  const extra = apiAuthHeaders() as Record<string, string>
  if (extra.Authorization) headers.set('Authorization', extra.Authorization)
  return fetch(input, { ...init, credentials: 'include', headers })
}
