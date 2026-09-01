#!/usr/bin/env bash
# Depuis votre Mac : build + upload + déploiement distant (nécessite SSH root@82.29.170.136)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${VPS_HOST:-82.29.170.136}"
VPS_USER="${VPS_USER:-root}"
REMOTE_DIR="/opt/toubatv"

echo "→ Build local…"
cd "$ROOT"
npm run build
"$ROOT/scripts/package-for-vps.sh"

ZIP="$ROOT/deploy/out/appttv-vps.zip"
REMOTE_ZIP="$REMOTE_DIR/appttv-vps.zip"

echo "-> Upload vers ${VPS_USER}@${VPS_HOST}..."
scp "$ZIP" "${VPS_USER}@${VPS_HOST}:${REMOTE_ZIP}"

echo "→ Déploiement distant…"
ssh "${VPS_USER}@${VPS_HOST}" "bash -s" <<'REMOTE'
set -euo pipefail
TOUBATV="/opt/toubatv"
APP="$TOUBATV/appttv"
ZIP="$TOUBATV/appttv-vps.zip"

command -v unzip >/dev/null || (apt-get update && apt-get install -y unzip)

cd "$TOUBATV"
unzip -o "$ZIP"
cd "$APP"

if [[ -f .env ]]; then
  grep -q '^GOOGLE_DRIVE_ENABLED=' .env || echo 'GOOGLE_DRIVE_ENABLED=true' >> .env
  grep -q '^GOOGLE_DRIVE_FOLDER_ID=' .env || echo 'GOOGLE_DRIVE_FOLDER_ID=18Bi3LLPT0fWOy_Smgs9gkvyC0neL9M9m' >> .env
fi

chmod +x scripts/*.sh
npm ci
npm run build
pm2 restart touba-appttv --update-env

curl -sf "http://127.0.0.1:3010/appttv/health"
echo ""
pm2 logs touba-appttv --lines 20 --nostream | grep -E '\[drive\]|Error|error' || true
REMOTE

echo ""
echo "✓ Déploiement terminé : https://stream.broadcastsn.com/appttv"
