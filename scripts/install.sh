#!/usr/bin/env bash
# Installation appttv — à lancer UNIQUEMENT depuis le dossier appttv/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f package.json ]] || ! grep -q '"touba-tv-appttv"' package.json 2>/dev/null; then
  echo "Erreur : exécutez ce script depuis le dossier appttv/"
  echo "  cd \"$(dirname "$ROOT")/appttv\" && ./scripts/install.sh"
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "→ Fichier .env créé — éditez FIREBASE_WEB_APP_ID et VMIX_DS_TOKEN"
fi

echo "→ npm ci (dossier appttv uniquement)"
if [[ -f dist/server.js ]]; then
  echo "  dist/ présent — installation production (--omit=dev)"
  npm ci --omit=dev
else
  npm ci
  echo "→ build TypeScript"
  npm run build
fi

# Dossiers stockage VPS (messages + photos)
VPS_DIR="$(grep -E '^VPS_DATA_DIR=' .env 2>/dev/null | cut -d= -f2- || echo /opt/toubatv/appttv/data/vps)"
VPS_DIR="${VPS_DIR:-/opt/toubatv/appttv/data/vps}"
mkdir -p "$VPS_DIR/messages" "$VPS_DIR/uploads" "$VPS_DIR/audit"
echo "→ Stockage VPS : $VPS_DIR"

if command -v pm2 >/dev/null 2>&1; then
  pm2 start ecosystem.config.cjs --update-env || pm2 restart touba-appttv --update-env
  pm2 save
  echo "→ PM2 : touba-appttv démarré"
else
  echo "PM2 absent. Installez-le : npm install -g pm2"
  echo "Puis : pm2 start ecosystem.config.cjs && pm2 save"
  echo "Ou test : npm run start:prod"
fi

echo ""
echo "Admin : https://stream.broadcastsn.com/appttv"
echo "XML vMix : https://stream.broadcastsn.com/appttv/vmix/current.xml?token=VOTRE_TOKEN"
echo "Nginx : sudo cp deploy/nginx-includes/appttv.conf /etc/nginx/snippets/ && sudo nginx -t && sudo systemctl reload nginx"
