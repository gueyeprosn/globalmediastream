import { describe, expect, it, beforeEach } from 'vitest'
import {
  clearLoginRateLimitStore,
  isLoginBlocked,
  recordLoginFailure,
  recordLoginSuccess,
} from './login-rate-limit'

describe('login-rate-limit', () => {
  beforeEach(() => {
    clearLoginRateLimitStore()
  })

  it('blocks after MAX_FAILURES', () => {
    const ip = 'unit-test-ip'
    recordLoginSuccess(ip)
    expect(isLoginBlocked(ip)).toBe(false)
    for (let i = 0; i < 20; i++) {
      recordLoginFailure(ip)
    }
    expect(isLoginBlocked(ip)).toBe(true)
  })

  it('clears on success', () => {
    const ip = 'unit-test-ip-2'
    recordLoginFailure(ip)
    recordLoginSuccess(ip)
    expect(isLoginBlocked(ip)).toBe(false)
  })
})
