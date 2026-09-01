/**
 * PM2 lance Next directement (pas `npm start`) pour que mémoire / restart
 * correspondent au serveur réel, pas au petit processus npm parent.
 *
 * Après chaque `npm run build` : `pm2 restart oceanfm-app` (ou `npm run deploy`).
 * Sinon chunks /_next/static/* obsolètes → 500 et login cassé.
 */
module.exports = {
  apps: [
    {
      name: 'oceanfm-app',
      cwd: __dirname,
      script: './node_modules/next/dist/bin/next',
      args: ['start', '-H', '127.0.0.1', '-p', '3000'],
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 15,
      min_uptime: '10s',
      max_memory_restart: '800M',
      kill_timeout: 10_000,
      exp_backoff_restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        HOSTNAME: '127.0.0.1',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
    {
      /**
       * Process séparé de oceanfm-app : survit aux redéploiements du
       * dashboard (npm run deploy ne le touche pas). Bind loopback
       * uniquement (127.0.0.1:3011), pas de proxy Nginx public pour
       * l'instant — rien n'y est branché côté UI (squelette §B1).
       */
      name: 'ops-engine',
      cwd: __dirname,
      script: './node_modules/.bin/tsx',
      args: ['ops-engine/index.ts'],
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 15,
      min_uptime: '10s',
      max_memory_restart: '400M',
      kill_timeout: 10_000,
      exp_backoff_restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        OPS_ENGINE_PORT: '3011',
        OPS_ENGINE_TICK_MS: '10000',
      },
    },
  ],
}
