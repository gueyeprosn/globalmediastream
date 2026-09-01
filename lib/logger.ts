/**
 * Logs structurés JSON sur stdout (journald). Utiliser requestId depuis les en-têtes.
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

function emit(
  level: LogLevel,
  scope: string,
  message: string,
  meta?: Record<string, unknown>
) {
  const line = {
    time: new Date().toISOString(),
    level,
    scope,
    message,
    ...meta,
  }
  const s = JSON.stringify(line)
  if (level === 'error') console.error(s)
  else if (level === 'warn') console.warn(s)
  else console.log(s)
}

export function requestIdFrom(request: Pick<Request, 'headers'>): string | undefined {
  return request.headers.get('x-request-id') ?? undefined
}

export function logError(
  request: Pick<Request, 'headers'>,
  scope: string,
  message: string,
  meta?: Record<string, unknown>
) {
  emit('error', scope, message, { requestId: requestIdFrom(request), ...meta })
}

export function logWarn(
  request: Pick<Request, 'headers'>,
  scope: string,
  message: string,
  meta?: Record<string, unknown>
) {
  emit('warn', scope, message, { requestId: requestIdFrom(request), ...meta })
}

export function logInfo(
  request: Pick<Request, 'headers'>,
  scope: string,
  message: string,
  meta?: Record<string, unknown>
) {
  emit('info', scope, message, { requestId: requestIdFrom(request), ...meta })
}
