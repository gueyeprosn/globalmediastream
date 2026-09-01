/**
 * Point d'entrée du process ops-engine (PM2, app séparée de oceanfm-app).
 * Bind loopback uniquement — jamais exposé directement, pas de proxy Nginx
 * public à ce stade (squelette B1 : rien n'est branché côté UI/dashboard).
 *
 * Rôle : collecte en arrière-plan (survit aux redéploiements du dashboard,
 * contrairement à un setInterval dans le process Next.js) + petite API HTTP
 * interne que le dashboard pourra consommer plus tard (§B2, Media Gateway).
 */

import { createServer } from 'node:http'
import { startTicker, getLatestSnapshot } from './ticker'

const PORT = Number(process.env.OPS_ENGINE_PORT || 3011)
const HOST = '127.0.0.1'
const TICK_INTERVAL_MS = Number(process.env.OPS_ENGINE_TICK_MS || 10_000)

function log(level: 'info' | 'error', message: string, meta: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ time: new Date().toISOString(), level, scope: 'ops-engine', message, ...meta }))
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}`)

  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, uptimeSec: Math.round(process.uptime()) }))
    return
  }

  if (url.pathname === '/metrics/system') {
    const snapshot = getLatestSnapshot()
    if (!snapshot) {
      res.writeHead(503, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'no snapshot yet' }))
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(snapshot))
    return
  }

  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: 'not found' }))
})

server.listen(PORT, HOST, () => {
  log('info', `ops-engine à l'écoute sur ${HOST}:${PORT}`)
  startTicker(TICK_INTERVAL_MS)
})

process.on('SIGTERM', () => {
  log('info', 'SIGTERM reçu, arrêt propre')
  server.close(() => process.exit(0))
})

process.on('unhandledRejection', (err) => {
  log('error', 'unhandledRejection', { detail: String(err) })
})
