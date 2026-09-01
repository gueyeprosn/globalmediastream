import { spawn } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { isAlive, killWithEscalation } from './process-kill'

function spawnChild(args: string[]): number {
  const child = spawn('bash', ['-c', args.join(' ')], { stdio: 'ignore' })
  if (child.pid == null) throw new Error('spawn failed')
  return child.pid
}

describe('process-kill', () => {
  it('reports already-dead for a pid that does not exist', async () => {
    const result = await killWithEscalation(999_999_999, { graceMs: 50, killTimeoutMs: 50 })
    expect(result.outcome).toBe('already-dead')
  })

  it('stops a process that responds to the grace signal', async () => {
    const pid = spawnChild(['sleep', '30'])
    expect(isAlive(pid)).toBe(true)
    const result = await killWithEscalation(pid, { graceSignal: 'SIGTERM', graceMs: 2_000 })
    expect(result.outcome).toBe('SIGTERM')
    expect(isAlive(pid)).toBe(false)
  }, 10_000)

  it('escalates to SIGKILL when the process ignores SIGINT/SIGTERM', async () => {
    // Boucle (pas un `sleep` final) : évite le tail-call exec de bash, qui
    // remplacerait le process et perdrait la disposition SIG_IGN du trap.
    const pid = spawnChild(['trap', '""', 'TERM', 'INT;', 'while', 'true;', 'do', 'sleep', '1;', 'done'])
    expect(isAlive(pid)).toBe(true)
    // Laisse bash finir son démarrage et enregistrer le trap avant d'envoyer
    // le premier signal (sinon course : SIGINT peut arriver avant `trap`).
    await new Promise((resolve) => setTimeout(resolve, 200))
    const result = await killWithEscalation(pid, {
      graceSignal: 'SIGINT',
      graceMs: 300,
      killTimeoutMs: 300,
    })
    expect(result.outcome).toBe('SIGKILL')
    expect(isAlive(pid)).toBe(false)
  }, 10_000)
})
