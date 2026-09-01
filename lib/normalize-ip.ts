/** Normalise une IP (IPv4-mapped IPv6, crochets). */
export function normalizeClientIp(raw: string): string {
  return String(raw || "")
    .replace(/^::ffff:/i, "")
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .trim()
}
