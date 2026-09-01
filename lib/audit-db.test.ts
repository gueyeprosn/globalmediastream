import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { insertAuditEntry as InsertFn, queryAuditLog as QueryFn } from './audit-db'

let insertAuditEntry: typeof InsertFn
let queryAuditLog: typeof QueryFn

describe('audit-db', () => {
  beforeAll(async () => {
    // AUDIT_DB_PATH doit être fixé avant le premier import du module
    // (singleton de connexion créé au premier appel de getAuditDb()).
    const dir = mkdtempSync(path.join(tmpdir(), 'audit-db-test-'))
    process.env.AUDIT_DB_PATH = path.join(dir, 'audit.db')
    ;({ insertAuditEntry, queryAuditLog } = await import('./audit-db'))

    insertAuditEntry({
      requestId: 'req-1',
      userSub: 'admin',
      userRole: 'super_admin',
      action: 'srs:kick',
      target: '/api/srs/clients/abc',
      result: 'success',
      durationMs: 42,
      ip: '203.0.113.5',
    })
    insertAuditEntry({
      action: 'system:cleanup',
      target: '/api/system/cleanup',
      result: 'error',
      durationMs: 1200,
    })
  })

  it('persists and reads back entries, most recent first', () => {
    const { rows, total } = queryAuditLog()
    expect(total).toBe(2)
    expect(rows).toHaveLength(2)
    expect(rows[0].action).toBe('system:cleanup')
    expect(rows[0].result).toBe('error')
    expect(rows[1].action).toBe('srs:kick')
    expect(rows[1].user_sub).toBe('admin')
    expect(rows[1].duration_ms).toBe(42)
  })

  it('filters by action', () => {
    const { rows, total } = queryAuditLog({ action: 'srs:kick' })
    expect(total).toBe(1)
    expect(rows[0].action).toBe('srs:kick')
  })

  it('paginates with limit/offset', () => {
    const page1 = queryAuditLog({ limit: 1, offset: 0 })
    const page2 = queryAuditLog({ limit: 1, offset: 1 })
    expect(page1.rows).toHaveLength(1)
    expect(page2.rows).toHaveLength(1)
    expect(page1.rows[0].id).not.toBe(page2.rows[0].id)
  })
})
