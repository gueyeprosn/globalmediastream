/** fetch vers /api/* avec cookie de session (credentials include). Pas de JWT en JS. */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? undefined)
  return fetch(input, { ...init, credentials: 'include', headers })
}

/** @deprecated Cookie-only — plus de Bearer côté client. */
export function apiAuthHeaders(): HeadersInit {
  return {}
}
