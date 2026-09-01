import { describe, expect, it } from 'vitest'
import {
  assertSafeStreamSlug,
  assertSafeSystemdUnit,
  sanitizeUfwComment,
  spawnCapture,
  STREAM_SLUG_RE,
} from './safe-shell'

describe('safe-shell', () => {
  it('accepts valid systemd units', () => {
    expect(assertSafeSystemdUnit('rtmp-foo.service')).toBe('rtmp-foo.service')
    expect(assertSafeSystemdUnit('icecast2.service')).toBe('icecast2.service')
  })

  it('rejects unsafe systemd units', () => {
    expect(() => assertSafeSystemdUnit('foo;rm -rf.service')).toThrow()
    expect(() => assertSafeSystemdUnit('../../../etc/passwd.service')).toThrow()
  })

  it('validates stream slugs', () => {
    expect(STREAM_SLUG_RE.test('my-stream')).toBe(true)
    expect(() => assertSafeStreamSlug('ab')).not.toThrow()
    expect(() => assertSafeStreamSlug('-bad')).toThrow()
  })

  it('sanitizes ufw comments', () => {
    expect(sanitizeUfwComment('RTMP foo;bar')).toBe('RTMP foo_bar')
  })

  it('spawnCapture rejects on timeout after SIGTERM/SIGKILL escalate', async () => {
    await expect(
      spawnCapture('sleep', ['5'], { timeoutMs: 200, killGraceMs: 200 })
    ).rejects.toThrow(/timed out/i)
  }, 10_000)
})
