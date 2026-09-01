const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 20

type Entry = { failures: number; windowStart: number }

const store = new Map<string, Entry>()

function prune(now: number) {
  for (const [ip, e] of store) {
    if (now - e.windowStart > WINDOW_MS) store.delete(ip)
  }
}

export function isLoginBlocked(ip: string): boolean {
  const now = Date.now()
  prune(now)
  const e = store.get(ip)
  if (!e) return false
  if (now - e.windowStart > WINDOW_MS) return false
  return e.failures >= MAX_FAILURES
}

/** À appeler après un échec de mot de passe. Retourne true si le client est maintenant bloqué. */
export function recordLoginFailure(ip: string): boolean {
  const now = Date.now()
  prune(now)
  let e = store.get(ip)
  if (!e || now - e.windowStart > WINDOW_MS) {
    e = { failures: 0, windowStart: now }
    store.set(ip, e)
  }
  e.failures += 1
  return e.failures >= MAX_FAILURES
}

export function recordLoginSuccess(ip: string): void {
  store.delete(ip)
}

/** Réservé aux tests (Vitest définit `process.env.VITEST`). */
export function clearLoginRateLimitStore(): void {
  if (process.env.VITEST) store.clear()
}

export function clientIpFromRequest(request: Request): string {
  const xf = request.headers.get('x-forwarded-for')
  if (xf) {
    const first = xf.split(',')[0]?.trim()
    if (first) return first.slice(0, 128)
  }
  const real = request.headers.get('x-real-ip')?.trim()
  if (real) return real.slice(0, 128)
  return 'unknown'
}
