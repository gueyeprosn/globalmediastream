#!/usr/bin/env bash
# À exécuter SUR le VPS (SSH ou console OVH) après upload de appttv-vps.zip
set -euo pipefail

TOUBATV="/opt/toubatv"
APP="$TOUBATV/appttv"
ZIP="${1:-$TOUBATV/appttv-vps.zip}"

echo "=== TOUBA TV appttv — mise à jour ==="

if [[ ! -f "$ZIP" ]]; then
  echo "Erreur : archive introuvable : $ZIP"
  echo "Uploadez appttv-vps.zip dans $TOUBATV/ puis relancez."
  exit 1
fi

command -v unzip >/dev/null || apt-get update && apt-get install -y unzip

cd "$TOUBATV"
unzip -o "$ZIP"

cd "$APP"

# Conserver .env existant ; ajouter Drive si absent
if [[ -f .env ]]; then
  grep -q '^GOOGLE_DRIVE_ENABLED=' .env || echo 'GOOGLE_DRIVE_ENABLED=true' >> .env
  grep -q '^GOOGLE_DRIVE_FOLDER_ID=' .env || echo 'GOOGLE_DRIVE_FOLDER_ID=18Bi3LLPT0fWOy_Smgs9gkvyC0neL9M9m' >> .env
else
  cp .env.example .env
  echo "⚠ Créez .env (FIREBASE_WEB_APP_ID, VMIX_DS_TOKEN) puis relancez install."
fi

chmod +x scripts/*.sh
npm ci
npm run build
pm2 restart touba-appttv --update-env || ./scripts/install.sh

echo ""
echo "=== Vérifications ==="
curl -sf "http://127.0.0.1:3010/appttv/health" | head -c 200
echo ""
pm2 logs touba-appttv --lines 15 --nostream 2>/dev/null | grep -E '\[drive\]|touba-appttv|error' || pm2 status

echo ""
echo "✓ Mise à jour terminée. Admin : https://stream.broadcastsn.com/appttv"
