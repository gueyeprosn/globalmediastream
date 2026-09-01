/** Construit une URL SRT listener pour FFmpeg (query encodée). */
export function buildSrtListenerUrl(
  host: string,
  port: number,
  opts: {
    passphrase: string
    streamid?: string
    latencyMs: number
  }
): string {
  const lat = opts.latencyMs
  const q = new URLSearchParams({
    mode: 'listener',
    transtype: 'live',
    passphrase: opts.passphrase,
    latency: String(lat),
    rcvlatency: String(Math.max(lat * 2, 2000)),
    peerlatency: String(lat),
  })
  if (opts.streamid?.trim()) {
    q.set('streamid', opts.streamid.trim())
  }
  return `srt://${host}:${port}?${q.toString()}`
}
