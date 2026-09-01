/** Plage UDP SRT (cahier des charges ~6000–6100). */
const DEFAULT_FROM = 6000
const DEFAULT_TO = 6100

/** Ports souvent déjà utilisés par SRS / flux fixes du serveur. */
const DEFAULT_RESERVED = new Set([
  7100, 7000, 8000, 1935, 1985, 8080, 2022,
  6000, 6001, 6002, 6003, 6004, 6005, 6006,
])

/** Entrée SRT « SRS natif » (HLS via /live/…), sans stack FFmpeg par flux. */
export const NATIVE_SRS_SRT_PORTS: ReadonlySet<number> = new Set([7100, 7000])

export function isNativeSrsSrtPort(port: number): boolean {
  return NATIVE_SRS_SRT_PORTS.has(port)
}

export function collectUsedSrtPorts(
  registry: Array<{ inputPort?: number; outputPort?: number; outputPorts?: number[] }>
): Set<number> {
  const used = new Set(DEFAULT_RESERVED)
  for (const r of registry) {
    if (typeof r.inputPort === 'number') used.add(r.inputPort)
    if (typeof r.outputPort === 'number') used.add(r.outputPort)
    for (const p of r.outputPorts || []) {
      if (typeof p === 'number') used.add(p)
    }
  }
  return used
}

/**
 * Réserve `count` ports UDP libres dans la plage configurée.
 */
export function allocateSrtUdpPorts(used: Set<number>, count: number): number[] {
  const from = Number(process.env.SRT_UDP_PORT_FROM || DEFAULT_FROM)
  const to = Number(process.env.SRT_UDP_PORT_TO || DEFAULT_TO)
  const allocated: number[] = []
  for (let p = from; p <= to && allocated.length < count; p++) {
    if (!used.has(p)) {
      allocated.push(p)
      used.add(p)
    }
  }
  if (allocated.length < count) {
    throw new Error(`Aucun port UDP libre (${count} requis) dans la plage ${from}-${to}`)
  }
  return allocated
}
