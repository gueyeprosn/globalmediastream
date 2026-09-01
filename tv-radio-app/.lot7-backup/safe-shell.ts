/**
 * Exécution de commandes sans shell (spawn) + validation des identifiants
 * passés à systemd / journalctl / ufw.
 */

import { spawn } from 'node:child_process'

const SYSTEMD_UNIT_RE = /^[a-zA-Z0-9:@._-]+\.(service|socket|target|timer)$/

/** Script de nettoyage VPS (seul chemin autorisé pour test/chmod côté cleanup API). */
export const CLEANUP_SCRIPT_PATH = '/srv/cleanup-vps-complete.sh'

/** Unités factices (pas d’appel systemctl is-active). */
export function isSrsNativePlaceholder(serviceName: string): boolean {
  return serviceName.startsWith('srs-native')
}

export function assertSafeSystemdUnit(name: string): string {
  if (typeof name !== 'string' || name.length > 200) {
    throw new Error('Invalid systemd unit')
  }
  if (isSrsNativePlaceholder(name)) {
    if (!/^srs-native[a-zA-Z0-9._-]*$/.test(name)) throw new Error('Invalid systemd unit')
    return name
  }
  if (!SYSTEMD_UNIT_RE.test(name)) {
    throw new Error('Invalid systemd unit')
  }
  return name
}

/** Accepte `icecast2` ou `icecast2.service` (identifiant court ou unité complète). */
export function toSafeServiceUnit(name: string): string {
  if (isSrsNativePlaceholder(name)) {
    return assertSafeSystemdUnit(name)
  }
  const withSuffix =
    name.endsWith('.service') ||
    name.endsWith('.socket') ||
    name.endsWith('.timer') ||
    name.endsWith('.target')
      ? name
      : `${name}.service`
  return assertSafeSystemdUnit(withSuffix)
}

export function isSafeSystemdUnit(name: string): boolean {
  if (isSrsNativePlaceholder(name)) {
    return /^srs-native[a-zA-Z0-9._-]*$/.test(name) && name.length < 100
  }
  try {
    assertSafeSystemdUnit(name)
    return true
  } catch {
    return false
  }
}

/** Slug stream (fichiers, registre) : lettres minuscules, chiffres, tirets. */
export const STREAM_SLUG_RE = /^(?:[a-z0-9]|[a-z0-9][a-z0-9-]{0,62}[a-z0-9])$/

export function assertSafeStreamSlug(id: string): string {
  if (typeof id !== 'string' || id.length > 64 || !STREAM_SLUG_RE.test(id)) {
    throw new Error('Invalid stream id')
  }
  return id
}

/** Paramètre dynamique `[id]` des routes (ex. rtmp-foo, bar-rtmp-output). */
export function assertSafeStreamRouteId(id: string): string {
  if (typeof id !== 'string' || id.length > 80 || !/^[a-z0-9-]+$/.test(id)) {
    throw new Error('Invalid stream id')
  }
  return id
}

export function sanitizeUfwComment(raw: string, maxLen = 80): string {
  const s = String(raw)
    .replace(/[^a-zA-Z0-9 _.-]/g, '_')
    .slice(0, maxLen)
    .trim()
  return s || 'stream'
}

export function assertTcpUdpPort(n: unknown): number {
  const p = typeof n === 'number' ? n : parseInt(String(n), 10)
  if (!Number.isInteger(p) || p < 1 || p > 65535) {
    throw new Error('Invalid port')
  }
  return p
}

export function spawnCapture(
  command: string,
  args: string[],
  options: { timeoutMs?: number; maxBuffer?: number; killGraceMs?: number } = {}
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const timeoutMs = options.timeoutMs ?? 120_000
  const maxBuffer = options.maxBuffer ?? 10 * 1024 * 1024
  /** Délai SIGTERM → SIGKILL + reject (évite Promise gelée si le binaire ignore TERM). */
  const killGraceMs = options.killGraceMs ?? 3_000

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
    let settled = false
    let failure: Error | null = null
    let killTimer: ReturnType<typeof setTimeout> | null = null
    const outAcc = { v: '' }
    const errAcc = { v: '' }

    const cleanup = () => {
      clearTimeout(timer)
      if (killTimer) clearTimeout(killTimer)
    }

    const settleResolve = (value: { stdout: string; stderr: string; code: number | null }) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(value)
    }

    const settleReject = (err: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(err)
    }

    const escalateKill = (reason: Error) => {
      if (failure) return
      failure = reason
      try {
        child.kill('SIGTERM')
      } catch {
        /* process déjà mort */
      }
      killTimer = setTimeout(() => {
        try {
          child.kill('SIGKILL')
        } catch {
          /* ignore */
        }
        settleReject(reason)
      }, killGraceMs)
    }

    const timer = setTimeout(() => {
      escalateKill(new Error(`Command timed out after ${timeoutMs}ms: ${command}`))
    }, timeoutMs)

    const onData = (buf: Buffer, acc: { v: string }) => {
      acc.v += buf.toString()
      if (acc.v.length > maxBuffer) {
        escalateKill(new Error(`Command output exceeded maxBuffer (${maxBuffer}): ${command}`))
      }
    }
    child.stdout?.on('data', (d) => onData(d, outAcc))
    child.stderr?.on('data', (d) => onData(d, errAcc))

    child.on('error', (err) => {
      settleReject(err instanceof Error ? err : new Error(String(err)))
    })
    child.on('close', (code) => {
      if (settled) return
      if (failure) {
        settleReject(failure)
        return
      }
      settleResolve({ stdout: outAcc.v, stderr: errAcc.v, code })
    })
  })
}

export async function spawnCaptureWithTimeout(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return spawnCapture(command, args, { timeoutMs })
}

export async function journalctlUnitLogs(
  unit: string,
  lines: number,
  shortIso = false,
  options: { since?: string; grep?: string } = {}
): Promise<string> {
  const u = assertSafeSystemdUnit(unit)
  const n = Math.min(Math.max(0, Math.floor(lines)), 5000)
  const args = ['-u', u, '--lines', String(n), '--no-pager']
  if (shortIso) {
    args.push('-o', 'short-iso')
  }
  if (options.since) {
    const since = parseSinceOption(options.since)
    if (since) args.push('--since', since)
  }
  const { stdout } = await spawnCapture('journalctl', args, { timeoutMs: 60_000 })
  if (!options.grep) return stdout
  const needle = options.grep.toLowerCase()
  return stdout
    .split('\n')
    .filter((line) => line.toLowerCase().includes(needle))
    .join('\n')
}

/** Convertit `15m`, `1h`, `2d` en argument journalctl `--since`. */
function parseSinceOption(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  if (/^\d+[smhd]$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s
  return null
}

export async function systemctlIsActive(unit: string): Promise<string> {
  if (isSrsNativePlaceholder(unit)) {
    return 'active'
  }
  const u = assertSafeSystemdUnit(unit)
  const { stdout } = await spawnCapture('systemctl', ['is-active', u], { timeoutMs: 8_000 })
  return stdout.trim().split('\n')[0] || 'inactive'
}

export async function systemctlIsActiveWithTimeout(
  unit: string,
  timeoutMs: number
): Promise<string> {
  if (isSrsNativePlaceholder(unit)) {
    return 'active'
  }
  if (!isSafeSystemdUnit(unit)) {
    return 'inactive'
  }
  const u = assertSafeSystemdUnit(unit)
  try {
    const { stdout } = await spawnCaptureWithTimeout('systemctl', ['is-active', u], timeoutMs)
    return stdout.trim().split('\n')[0] || 'inactive'
  } catch {
    return 'inactive'
  }
}

export async function systemctlShowValue(unit: string, property: string): Promise<string> {
  const u = assertSafeSystemdUnit(unit)
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(property)) {
    throw new Error('Invalid property')
  }
  const { stdout } = await spawnCapture(
    'systemctl',
    ['show', u, '-p', property, '--value'],
    { timeoutMs: 8_000 }
  )
  return stdout.trim()
}

export async function systemctlListUnitFilesHasService(unitFile: string): Promise<boolean> {
  const u = assertSafeSystemdUnit(unitFile)
  const { stdout } = await spawnCapture(
    'systemctl',
    ['list-unit-files', '--type=service', '--no-pager'],
    { timeoutMs: 60_000 }
  )
  return stdout.split('\n').some((line) => {
    const col = line.trim().split(/\s+/)[0]
    return col === u
  })
}

/** Aligné sur l’ancien `list-units | grep ^unit` (unité chargée / connue). */
export async function systemctlListUnitsHasService(unit: string): Promise<boolean> {
  const u = assertSafeSystemdUnit(unit)
  const { stdout } = await spawnCapture(
    'systemctl',
    ['list-units', '--type=service', '--all', '--no-pager'],
    { timeoutMs: 90_000 }
  )
  return stdout.split('\n').some((line) => line.trim().startsWith(u))
}

export async function systemctlDaemonReload(): Promise<void> {
  await spawnCapture('systemctl', ['daemon-reload'], { timeoutMs: 120_000 })
}

export async function systemctlEnable(unit: string): Promise<void> {
  const u = assertSafeSystemdUnit(unit)
  await spawnCapture('systemctl', ['enable', u], { timeoutMs: 60_000 })
}

export async function systemctlStart(unit: string): Promise<void> {
  const u = assertSafeSystemdUnit(unit)
  await spawnCapture('systemctl', ['start', u], { timeoutMs: 120_000 })
}

export async function systemctlStop(unit: string): Promise<void> {
  const u = assertSafeSystemdUnit(unit)
  await spawnCapture('systemctl', ['stop', u], { timeoutMs: 120_000 })
}

export async function systemctlDisable(unit: string): Promise<void> {
  const u = assertSafeSystemdUnit(unit)
  await spawnCapture('systemctl', ['disable', u], { timeoutMs: 60_000 })
}

export type SystemctlAction = 'start' | 'stop' | 'restart'

export async function systemctlAction(action: SystemctlAction, unit: string): Promise<void> {
  const u = assertSafeSystemdUnit(unit)
  await spawnCapture('systemctl', [action, u], { timeoutMs: 120_000 })
}

/** chmod +x sur un chemin sous /usr/local/bin (script généré). */
export function assertRtmpScriptPath(streamSlug: string): string {
  assertSafeStreamSlug(streamSlug)
  return `/usr/local/bin/rtmp-${streamSlug}.sh`
}

export function assertSrtScriptPath(streamSlug: string): string {
  assertSafeStreamSlug(streamSlug)
  return `/usr/local/bin/${streamSlug}.sh`
}

export async function chmodPlusX(absPath: string): Promise<void> {
  if (absPath === CLEANUP_SCRIPT_PATH) {
    await spawnCapture('chmod', ['+x', absPath], { timeoutMs: 10_000 })
    return
  }
  if (
    !absPath.startsWith('/usr/local/bin/') ||
    !/^\/usr\/local\/bin\/[a-z0-9._-]+\.sh$/.test(absPath)
  ) {
    throw new Error('Invalid script path')
  }
  await spawnCapture('chmod', ['+x', absPath], { timeoutMs: 10_000 })
}

export function getCleanupScriptPath(): string {
  return CLEANUP_SCRIPT_PATH
}

export async function runCleanupScript(
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return spawnCapture('bash', [CLEANUP_SCRIPT_PATH], { timeoutMs, maxBuffer: 10 * 1024 * 1024 })
}

export async function fileExistsViaTest(absPath: string): Promise<boolean> {
  if (absPath !== CLEANUP_SCRIPT_PATH) {
    throw new Error('path not allowed for test')
  }
  const { code } = await spawnCapture('test', ['-f', absPath], { timeoutMs: 5_000 })
  return code === 0
}

export async function fileExecutableViaTest(absPath: string): Promise<boolean> {
  if (absPath !== CLEANUP_SCRIPT_PATH) {
    throw new Error('path not allowed for test')
  }
  const { code } = await spawnCapture('test', ['-x', absPath], { timeoutMs: 5_000 })
  return code === 0
}

export async function ufwAllowTcp(port: number, comment: string): Promise<void> {
  const p = assertTcpUdpPort(port)
  const c = sanitizeUfwComment(comment)
  await spawnCapture('ufw', ['allow', `${p}/tcp`, 'comment', c], { timeoutMs: 60_000 })
}

export async function ufwAllowTcpQuiet(port: number, comment: string): Promise<void> {
  try {
    await ufwAllowTcp(port, comment)
  } catch {
    /* ufw peut retourner non-zéro si règle existe */
  }
}

export async function ufwAllowUdp(port: number, comment: string): Promise<void> {
  const p = assertTcpUdpPort(port)
  const c = sanitizeUfwComment(comment)
  await spawnCapture('ufw', ['allow', `${p}/udp`, 'comment', c], { timeoutMs: 60_000 })
}

export async function ufwDeleteAllowTcp(port: number): Promise<void> {
  const p = assertTcpUdpPort(port)
  await spawnCapture('ufw', ['delete', 'allow', `${p}/tcp`], { timeoutMs: 60_000 })
}

export async function ufwDeleteAllowTcpQuiet(port: number): Promise<void> {
  try {
    await ufwDeleteAllowTcp(port)
  } catch {
    /* ignore */
  }
}

export async function ufwDeleteAllowUdp(port: number): Promise<void> {
  const p = assertTcpUdpPort(port)
  await spawnCapture('ufw', ['delete', 'allow', `${p}/udp`], { timeoutMs: 60_000 })
}

export async function ufwDeleteAllowUdpQuiet(port: number): Promise<void> {
  try {
    await ufwDeleteAllowUdp(port)
  } catch {
    /* ignore */
  }
}

/** Première ligne ps aux contenant l’unité (évite grep shell). */
export async function psAuxFirstLineContaining(needle: string): Promise<string> {
  if (!isSafeSystemdUnit(needle) && !isSrsNativePlaceholder(needle)) {
    throw new Error('Invalid needle')
  }
  const { stdout } = await spawnCapture('ps', ['aux'], { timeoutMs: 15_000 })
  const lines = stdout.split('\n')
  for (const line of lines) {
    if (line.includes(needle) && !line.includes('grep')) {
      return line.trim()
    }
  }
  return ''
}

export async function systemctlShowLoadState(unit: string): Promise<string> {
  if (!isSafeSystemdUnit(unit)) {
    return 'not-found'
  }
  const u = assertSafeSystemdUnit(unit)
  const { stdout } = await spawnCapture(
    'systemctl',
    ['show', u, '-p', 'LoadState', '--value'],
    { timeoutMs: 8_000 }
  )
  return stdout.trim() || 'not-found'
}
