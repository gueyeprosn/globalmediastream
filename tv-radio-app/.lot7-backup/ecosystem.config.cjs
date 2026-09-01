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
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        HOSTNAME: '127.0.0.1',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
}
