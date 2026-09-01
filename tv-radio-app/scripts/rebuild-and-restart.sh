#!/usr/bin/env bash
# Rebuild Next.js from scratch + libère :3000 + PM2 restart.
# À utiliser quand le navigateur charge des chunks CSS/JS en 404/500 (hashes HTML ≠ fichiers sur disque).
set -euo pipefail
cd /srv/tv-radio-app
echo "==> Suppression .next"
rm -rf .next
echo "==> npm run build"
npm run build
echo "==> Redémarrage propre (port 3000 + PM2)"
exec bash scripts/restart-next-clean.sh
