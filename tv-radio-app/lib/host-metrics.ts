/**
 * Métriques hôte sans shell : /proc + spawnCapture (df, ss, systemctl, docker, pm2, tail).
 */

import { readdir, readFile } from "node:fs/promises"
import {
  assertTcpUdpPort,
  spawnCapture,
  systemctlIsActiveWithTimeout,
  toSafeServiceUnit,
} from "@/lib/safe-shell"

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseKb(line: string | undefined): number {
  if (!line) return 0
  const m = line.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

export type HostMemoryMb = {
  total: number
  used: number
  free: number
  cached: number
  percentage: number
}

export async function getMemoryMetricsFromProc(): Promise<HostMemoryMb> {
  try {
    const raw = await readFile("/proc/meminfo", "utf8")
    const lines = raw.split("\n")
    const map = new Map<string, number>()
    for (const line of lines) {
      const idx = line.indexOf(":")
      if (idx < 0) continue
      map.set(line.slice(0, idx), parseKb(line.slice(idx + 1)))
    }
    const totalKb = map.get("MemTotal") || 0
    const freeKb = map.get("MemFree") || 0
    const cachedKb = map.get("Cached") || 0
    const availableKb = map.get("MemAvailable") ?? freeKb
    const total = Math.round(totalKb / 1024)
    const free = Math.round(freeKb / 1024)
    const cached = Math.round(cachedKb / 1024)
    const used = Math.max(0, Math.round((totalKb - availableKb) / 1024))
    return {
      total,
      used,
      free,
      cached,
      percentage: total > 0 ? Math.round((used / total) * 100) : 0,
    }
  } catch {
    return { total: 0, used: 0, free: 0, cached: 0, percentage: 0 }
  }
}

export type HostDiskGb = {
  total: number
  used: number
  free: number
  percentage: number
  mountPoint: string
}

/** Parse `df -P` (blocs 1K) pour un chemin. */
export function parseDfDashPLine(stdout: string): HostDiskGb {
  const lines = stdout
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) throw new Error("df parse error")
  const cols = lines[lines.length - 1].split(/\s+/)
  if (cols.length < 6) throw new Error("df parse error")
  const totalKb = Number(cols[1])
  const usedKb = Number(cols[2])
  const availKb = Number(cols[3])
  const percentage = Number(String(cols[4]).replace("%", ""))
  const mountPoint = cols.slice(5).join(" ") || "/"
  const toGb = (kb: number) => Number((kb / (1024 * 1024)).toFixed(1))
  return {
    total: toGb(totalKb),
    used: toGb(usedKb),
    free: toGb(availKb),
    percentage: Number.isFinite(percentage) ? percentage : 0,
    mountPoint,
  }
}

export async function getDiskMetricsViaDf(path = "/"): Promise<HostDiskGb> {
  try {
    if (typeof path !== "string" || !path.startsWith("/") || path.includes("..")) {
      throw new Error("invalid path")
    }
    const { stdout, code } = await spawnCapture("df", ["-P", path], { timeoutMs: 8_000 })
    if (code !== 0) throw new Error("df failed")
    return parseDfDashPLine(stdout)
  } catch {
    return { total: 0, used: 0, free: 0, percentage: 0, mountPoint: path }
  }
}

function parseProcStatCpu(raw: string): { idle: number; total: number } {
  const line = raw.split("\n").find((l) => l.startsWith("cpu "))
  if (!line) return { idle: 0, total: 0 }
  const parts = line.trim().split(/\s+/).slice(1).map(Number)
  const idle = (parts[3] || 0) + (parts[4] || 0)
  const total = parts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
  return { idle, total }
}

/** Échantillonnage /proc/stat (~100ms) — évite vmstat bloquant 1s. */
export async function getCpuUsageFromProc(sampleMs = 100): Promise<number> {
  try {
    const s1 = parseProcStatCpu(await readFile("/proc/stat", "utf8"))
    await sleep(sampleMs)
    const s2 = parseProcStatCpu(await readFile("/proc/stat", "utf8"))
    const idleDelta = s2.idle - s1.idle
    const totalDelta = s2.total - s1.total
    if (totalDelta <= 0) return 0
    return Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)))
  } catch {
    return 0
  }
}

export async function getCpuLoadFromProc(): Promise<{
  load1: number
  load5: number
  load15: number
}> {
  try {
    const raw = (await readFile("/proc/loadavg", "utf8")).trim().split(/\s+/)
    return {
      load1: parseFloat(raw[0]) || 0,
      load5: parseFloat(raw[1]) || 0,
      load15: parseFloat(raw[2]) || 0,
    }
  } catch {
    return { load1: 0, load5: 0, load15: 0 }
  }
}

export async function getNetworkFromProc(): Promise<{
  interfaces: Array<{ name: string; rxBytes: number; txBytes: number }>
}> {
  try {
    const raw = await readFile("/proc/net/dev", "utf8")
    const interfaces: Array<{ name: string; rxBytes: number; txBytes: number }> = []
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!/^(eth0|ens|enp)/.test(trimmed)) continue
      const parts = trimmed.split(/\s+/)
      if (parts.length < 10) continue
      interfaces.push({
        name: parts[0].replace(":", ""),
        rxBytes: parseInt(parts[1], 10) || 0,
        txBytes: parseInt(parts[9], 10) || 0,
      })
      if (interfaces.length >= 2) break
    }
    return { interfaces }
  } catch {
    return { interfaces: [] }
  }
}

export async function getProcessMetricsFromProc(): Promise<{
  total: number
  running: number
  sleeping: number
  zombie: number
}> {
  try {
    const entries = await readdir("/proc", { withFileTypes: true })
    let total = 0
    let running = 0
    let sleeping = 0
    let zombie = 0
    await Promise.all(
      entries.map(async (ent) => {
        if (!ent.isDirectory() || !/^\d+$/.test(ent.name)) return
        total += 1
        try {
          const stat = await readFile(`/proc/${ent.name}/stat`, "utf8")
          const m = stat.match(/\)\s+([RSDZTtWXxKWP])/ )
          const state = m?.[1]
          if (state === "R") running += 1
          else if (state === "S" || state === "D") sleeping += 1
          else if (state === "Z") zombie += 1
        } catch {
          /* pid disparu */
        }
      })
    )
    return { total, running, sleeping, zombie }
  } catch {
    return { total: 0, running: 0, sleeping: 0, zombie: 0 }
  }
}

export async function getUptimeFromProc(): Promise<string> {
  try {
    const raw = await readFile("/proc/uptime", "utf8")
    const seconds = parseFloat(raw.split(" ")[0])
    if (!Number.isFinite(seconds)) return "Unknown"
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days} days, ${hours} hours, ${minutes} minutes`
  } catch {
    return "Unknown"
  }
}

const DOCKER_NAME_RE = /^[a-z][a-z0-9_-]{0,62}$/i

export async function getDockerRunningStatus(
  name: string
): Promise<"running" | "stopped" | "unknown"> {
  if (!DOCKER_NAME_RE.test(name)) return "unknown"
  try {
    const { stdout, code } = await spawnCapture(
      "docker",
      ["inspect", "-f", "{{.State.Running}}", name],
      { timeoutMs: 8_000 }
    )
    if (code !== 0) return "unknown"
    return stdout.trim() === "true" ? "running" : "stopped"
  } catch {
    return "unknown"
  }
}

export async function getDockerStatusMap(): Promise<{
  srs: "running" | "stopped" | "unknown"
  oryx: "running" | "stopped" | "unknown"
}> {
  const [srs, oryx] = await Promise.all([
    getDockerRunningStatus("srs"),
    getDockerRunningStatus("oryx"),
  ])
  return { srs, oryx }
}

export async function getSystemdActive(
  service: string
): Promise<"active" | "inactive"> {
  try {
    const unit = toSafeServiceUnit(service)
    const state = await systemctlIsActiveWithTimeout(unit, 5_000)
    return state === "active" ? "active" : "inactive"
  } catch {
    return "inactive"
  }
}

export async function getPm2Active(): Promise<"active" | "inactive"> {
  try {
    const { code } = await spawnCapture("pm2", ["pid", "oceanfm-app"], {
      timeoutMs: 8_000,
    })
    return code === 0 ? "active" : "inactive"
  } catch {
    return "inactive"
  }
}

export async function getHostServicesStatus(): Promise<{
  nginx: "active" | "inactive"
  pm2: "active" | "inactive"
  icecast2: "active" | "inactive"
}> {
  const [nginx, pm2, icecast2] = await Promise.all([
    getSystemdActive("nginx"),
    getPm2Active(),
    getSystemdActive("icecast2"),
  ])
  return { nginx, pm2, icecast2 }
}

/** Sortie `ss -tnp` filtrée côté JS (pas de grep shell). */
export function parseSsEstablishedRemoteIps(stdout: string, port: number): string[] {
  const needle = `:${port}`
  const ips: string[] = []
  const seen = new Set<string>()
  for (const line of stdout.split("\n")) {
    if (!line.includes(needle)) continue
    if (!line.includes("ESTAB") && !line.includes("ESTABLISHED")) continue
    const matches = [...line.matchAll(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+/g)]
    for (const m of matches) {
      const ip = m[1]
      if (ip === "127.0.0.1" || ip === "0.0.0.0") continue
      // Prefer peer (usually second address) but collect unique non-local
      if (!seen.has(ip)) {
        seen.add(ip)
        ips.push(ip)
      }
    }
  }
  return ips
}

export async function captureSsTcp(): Promise<string> {
  const { stdout, code } = await spawnCapture("ss", ["-tnp"], { timeoutMs: 8_000 })
  if (code !== 0) return ""
  return stdout
}

export async function readProcessComm(pid: string): Promise<string> {
  if (!/^\d{1,10}$/.test(pid)) return ""
  try {
    const { stdout, code } = await spawnCapture("ps", ["-p", pid, "-o", "comm="], {
      timeoutMs: 5_000,
    })
    if (code !== 0) return ""
    return stdout.trim()
  } catch {
    return ""
  }
}

const NGINX_LOG_RE = /^\/var\/log\/nginx\/[a-zA-Z0-9._-]+$/

export function assertSafeNginxAccessLog(path: string): string {
  if (!NGINX_LOG_RE.test(path)) {
    throw new Error("Invalid nginx access log path")
  }
  return path
}

export async function tailFileLines(absPath: string, lines: number): Promise<string> {
  const n = Math.min(Math.max(1, Math.floor(lines)), 50_000)
  const safe = absPath.startsWith("/var/log/nginx/")
    ? assertSafeNginxAccessLog(absPath)
    : (() => {
        throw new Error("path not allowed for tail")
      })()
  try {
    const { stdout, code } = await spawnCapture("tail", ["-n", String(n), safe], {
      timeoutMs: 15_000,
      maxBuffer: 10 * 1024 * 1024,
    })
    if (code !== 0) return ""
    return stdout
  } catch {
    return ""
  }
}

export function assertSafeListenPort(port: number): number {
  return assertTcpUdpPort(port)
}
