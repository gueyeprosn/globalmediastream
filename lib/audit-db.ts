/**
 * Base SQLite dédiée à l'audit trail (qui a fait quoi/quand/résultat).
 * Propriété exclusive du process Next.js (PM2 fork mode, une seule
 * instance) — pas de conflit d'accès concurrent à prévoir.
 */

import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { getAuditDbPath } from '@/lib/paths'

export type AuditLogRow = {
  id: number
  timestamp: string
  request_id: string | null
  user_sub: string | null
  user_role: string | null
  action: string
  target: string | null
  result: string
  duration_ms: number | null
  ip: string | null
}

let db: Database.Database | null = null

export function getAuditDb(): Database.Database {
  if (db) return db
  const dbPath = getAuditDbPath()
  mkdirSync(path.dirname(dbPath), { recursive: true })
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      request_id TEXT,
      user_sub TEXT,
      user_role TEXT,
      action TEXT NOT NULL,
      target TEXT,
      result TEXT NOT NULL,
      duration_ms INTEGER,
      ip TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_log_user_sub ON audit_log(user_sub);
  `)
  return db
}

export type AuditEntry = {
  requestId?: string | null
  userSub?: string | null
  userRole?: string | null
  action: string
  target?: string | null
  result: string
  durationMs?: number | null
  ip?: string | null
}

export function insertAuditEntry(entry: AuditEntry): void {
  const database = getAuditDb()
  database
    .prepare(
      `INSERT INTO audit_log
        (timestamp, request_id, user_sub, user_role, action, target, result, duration_ms, ip)
       VALUES (@timestamp, @requestId, @userSub, @userRole, @action, @target, @result, @durationMs, @ip)`
    )
    .run({
      timestamp: new Date().toISOString(),
      requestId: entry.requestId ?? null,
      userSub: entry.userSub ?? null,
      userRole: entry.userRole ?? null,
      action: entry.action,
      target: entry.target ?? null,
      result: entry.result,
      durationMs: entry.durationMs ?? null,
      ip: entry.ip ?? null,
    })
}

export type AuditQuery = {
  limit?: number
  offset?: number
  userSub?: string
  action?: string
  since?: string
}

export function queryAuditLog(query: AuditQuery = {}): { rows: AuditLogRow[]; total: number } {
  const database = getAuditDb()
  const limit = Math.min(Math.max(1, query.limit ?? 50), 500)
  const offset = Math.max(0, query.offset ?? 0)

  const conditions: string[] = []
  const params: Record<string, unknown> = {}
  if (query.userSub) {
    conditions.push('user_sub = @userSub')
    params.userSub = query.userSub
  }
  if (query.action) {
    conditions.push('action = @action')
    params.action = query.action
  }
  if (query.since) {
    conditions.push('timestamp >= @since')
    params.since = query.since
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const rows = database
    .prepare(
      `SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset }) as AuditLogRow[]

  const total = (
    database.prepare(`SELECT COUNT(*) as count FROM audit_log ${where}`).get(params) as {
      count: number
    }
  ).count

  return { rows, total }
}
