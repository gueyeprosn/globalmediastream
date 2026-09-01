/**
 * Wrapper d'audit trail pour les routes destructives. Englobe le handler
 * complet (pas seulement l'auth) car le résultat et la durée ne sont connus
 * qu'après exécution. Écriture en fire-and-forget : ne bloque jamais la
 * réponse HTTP et ne doit jamais faire planter la route.
 */

import type { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import { insertAuditEntry } from '@/lib/audit-db'
import { requestIdFrom } from '@/lib/logger'

type AnyRequest = NextRequest | Request
type Handler<Req extends AnyRequest, Args extends unknown[]> = (
  request: Req,
  ...args: Args
) => Promise<NextResponse>

function clientIp(request: AnyRequest): string | null {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || null
  return request.headers.get('x-real-ip')
}

function targetFromRequest(request: AnyRequest): string {
  try {
    return new URL(request.url).pathname
  } catch {
    return request.url
  }
}

function logAudit(request: AnyRequest, action: string, result: string, durationMs: number) {
  void (async () => {
    try {
      const auth = await requireAuth(request)
      insertAuditEntry({
        requestId: requestIdFrom(request) ?? null,
        userSub:
          auth.ok && typeof auth.payload.sub === 'string' ? auth.payload.sub : null,
        userRole:
          auth.ok && typeof auth.payload.role === 'string' ? auth.payload.role : null,
        action,
        target: targetFromRequest(request),
        result,
        durationMs,
        ip: clientIp(request),
      })
    } catch {
      /* best-effort : ne doit jamais faire planter la route appelante */
    }
  })()
}

export function withAudit<Req extends AnyRequest, Args extends unknown[]>(
  action: string,
  handler: Handler<Req, Args>
): Handler<Req, Args> {
  return async (request: Req, ...args: Args): Promise<NextResponse> => {
    const start = Date.now()
    let response: NextResponse
    try {
      response = await handler(request, ...args)
    } catch (error) {
      logAudit(request, action, 'error', Date.now() - start)
      throw error
    }
    logAudit(request, action, response.status >= 400 ? 'error' : 'success', Date.now() - start)
    return response
  }
}
