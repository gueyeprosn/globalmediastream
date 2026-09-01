import { describe, expect, it } from 'vitest'
import { assertSafeProbeUrl, redactProbeUrl } from '@/lib/stream-monitoring/ffprobe'

describe('assertSafeProbeUrl', () => {
  it('accepte rtmp/http/https/file absolu', () => {
    expect(assertSafeProbeUrl('rtmp://127.0.0.1:1935/live/key')).toContain('rtmp://')
    expect(assertSafeProbeUrl('rtmps://127.0.0.1/live/key')).toContain('rtmps:')
    expect(assertSafeProbeUrl('https://stream.broadcastsn.com/hls/x.m3u8')).toContain('https://')
    expect(assertSafeProbeUrl('http://127.0.0.1/hls/x.m3u8')).toContain('http://')
    expect(assertSafeProbeUrl('file:///srv/hls/x.m3u8')).toContain('file:')
  })

  it('rejette schémas invalides et formes non parseables', () => {
    expect(() => assertSafeProbeUrl('ftp://evil')).toThrow()
    expect(() => assertSafeProbeUrl('')).toThrow()
    expect(() => assertSafeProbeUrl('not-a-url')).toThrow()
    expect(() => assertSafeProbeUrl('javascript:alert(1)')).toThrow()
    expect(() => assertSafeProbeUrl('file://relative-no-abs')).toThrow()
  })

  it('accepte des caractères spéciaux en littéral (spawn args, pas de shell)', () => {
    // Avec spawn sans shell, "; $(id) `" restent des caractères d'argument, pas d'exécution.
    const u = assertSafeProbeUrl('rtmp://127.0.0.1/live/x$(id)')
    expect(u).toContain('rtmp://')
  })

  it('redacte les credentials', () => {
    expect(redactProbeUrl('rtmp://user:secret@host/live')).toBe('rtmp://***@host/live')
  })
})
