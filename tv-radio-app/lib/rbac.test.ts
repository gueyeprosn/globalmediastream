import { describe, expect, it } from 'vitest'
import { hasPermission } from './rbac'

describe('rbac', () => {
  it('viewer has no permissions', () => {
    expect(hasPermission('viewer', 'stream:restart')).toBe(false)
    expect(hasPermission('viewer', 'recording:start')).toBe(false)
    expect(hasPermission('viewer', 'system:cleanup')).toBe(false)
  })

  it('operator can restart/kick/record but not delete or cleanup', () => {
    expect(hasPermission('operator', 'stream:restart')).toBe(true)
    expect(hasPermission('operator', 'srs:kick')).toBe(true)
    expect(hasPermission('operator', 'recording:start')).toBe(true)
    expect(hasPermission('operator', 'recording:stop')).toBe(true)
    expect(hasPermission('operator', 'stream:delete')).toBe(false)
    expect(hasPermission('operator', 'system:cleanup')).toBe(false)
    expect(hasPermission('operator', 'recording:delete')).toBe(false)
  })

  it('admin can do everything operator can plus destructive/admin actions', () => {
    expect(hasPermission('admin', 'stream:delete')).toBe(true)
    expect(hasPermission('admin', 'system:cleanup')).toBe(true)
    expect(hasPermission('admin', 'recording:delete')).toBe(true)
    expect(hasPermission('admin', 'stream:restart')).toBe(true)
  })

  it('super_admin has the same action set as admin today', () => {
    const actions = [
      'stream:restart',
      'stream:create',
      'stream:update',
      'stream:delete',
      'stream:rollback',
      'srs:kick',
      'srs:reload',
      'system:cleanup',
      'recording:start',
      'recording:stop',
      'recording:delete',
    ] as const
    for (const action of actions) {
      expect(hasPermission('super_admin', action)).toBe(hasPermission('admin', action))
    }
  })
})
