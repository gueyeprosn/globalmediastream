/**
 * Arrêt d'un process détaché par PID (pas de handle `child`, juste un PID
 * persisté — cas des enregistrements ffmpeg). Escalade signal par signal
 * jusqu'à confirmation de sortie, sur le même principe que `escalateKill()`
 * dans `safe-shell.ts` (qui opère sur un `child` de spawn, pas un PID nu).
 */

export type KillEscalationResult = {
  /** Signal qui a effectivement mis fin au process, ou 'already-dead' / 'unresponsive'. */
  outcome: 'already-dead' | NodeJS.Signals | 'unresponsive'
}

/** true si le process existe encore (ne l'affecte pas : signal 0). */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitUntilDead(pid: number, timeoutMs: number, pollMs = 200): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return true
    await sleep(pollMs)
  }
  return !isAlive(pid)
}

/**
 * Envoie `graceSignal` (arrêt propre, ex. SIGINT pour ffmpeg), attend
 * `graceMs`. Si le process est toujours vivant : SIGTERM, attend
 * `killTimeoutMs`. Si toujours vivant : SIGKILL.
 */
export async function killWithEscalation(
  pid: number,
  options: {
    graceSignal?: NodeJS.Signals
    graceMs?: number
    killTimeoutMs?: number
  } = {}
): Promise<KillEscalationResult> {
  const graceSignal = options.graceSignal ?? 'SIGINT'
  const graceMs = options.graceMs ?? 3_000
  const killTimeoutMs = options.killTimeoutMs ?? 2_000

  if (!isAlive(pid)) {
    return { outcome: 'already-dead' }
  }

  try {
    process.kill(pid, graceSignal)
  } catch {
    return { outcome: 'already-dead' }
  }
  if (await waitUntilDead(pid, graceMs)) {
    return { outcome: graceSignal }
  }

  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    return { outcome: 'already-dead' }
  }
  if (await waitUntilDead(pid, killTimeoutMs)) {
    return { outcome: 'SIGTERM' }
  }

  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    return { outcome: 'already-dead' }
  }
  if (await waitUntilDead(pid, killTimeoutMs)) {
    return { outcome: 'SIGKILL' }
  }

  return { outcome: 'unresponsive' }
}

export { isAlive }
