/**
 * Base SQLite du moteur de monitoring (séries temporelles, futurs incidents).
 * Distincte d'audit.db (lib/audit-db.ts, propriété du process Next.js) —
 * ops.db est la propriété exclusive de ce process séparé (ops-engine).
 */

import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

function getOpsDbPath(): string {
  return process.env.OPS_DB_PATH || `${(process.env.STREAMING_BASE_PATH || '/srv').replace(/\/$/, '')}/ops.db`
}

let db: Database.Database | null = null

export function getOpsDb(): Database.Database {
  if (db) return db
  const dbPath = getOpsDbPath()
  mkdirSync(path.dirname(dbPath), { recursive: true })
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      cpu_usage REAL,
      mem_used_mb REAL,
      mem_total_mb REAL,
      disk_used_percent REAL,
      disk_free_gb REAL,
      overall_status TEXT,
      overall_score INTEGER,
      srs_publisher_count INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp);
  `)
  return db
}

export type SystemMetricsRow = {
  timestamp: string
  cpuUsage: number | null
  memUsedMb: number | null
  memTotalMb: number | null
  diskUsedPercent: number | null
  diskFreeGb: number | null
  overallStatus: string | null
  overallScore: number | null
  srsPublisherCount: number | null
}

export function insertSystemMetrics(row: SystemMetricsRow): void {
  getOpsDb()
    .prepare(
      `INSERT INTO system_metrics
        (timestamp, cpu_usage, mem_used_mb, mem_total_mb, disk_used_percent, disk_free_gb,
         overall_status, overall_score, srs_publisher_count)
       VALUES (@timestamp, @cpuUsage, @memUsedMb, @memTotalMb, @diskUsedPercent, @diskFreeGb,
         @overallStatus, @overallScore, @srsPublisherCount)`
    )
    .run(row)
}

/** Purge les échantillons plus vieux que `days` (défaut 14j) — appelé périodiquement par le ticker. */
export function pruneSystemMetrics(days = 14): number {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  const result = getOpsDb().prepare(`DELETE FROM system_metrics WHERE timestamp < ?`).run(cutoff)
  return result.changes
}
