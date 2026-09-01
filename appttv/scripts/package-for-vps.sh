#!/usr/bin/env bash
# Crée une archive ZIP prête à uploader sur le VPS (sans node_modules ni secrets)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARENT="$(dirname "$ROOT")"
NAME="$(basename "$ROOT")"
OUT_DIR="$ROOT/deploy/out"
STAMP="$(date +%Y%m%d-%H%M)"
ZIP_STAMPED="$OUT_DIR/appttv-vps-${STAMP}.zip"
ZIP_LATEST="$OUT_DIR/appttv-vps.zip"

mkdir -p "$OUT_DIR"

echo "→ Build TypeScript (dist/)…"
cd "$ROOT"
npm run build

echo "→ Empaquetage $NAME → ZIP"

cd "$PARENT"

zip -r "$ZIP_STAMPED" "$NAME" \
  -x "$NAME/node_modules/*" \
  -x "$NAME/.env" \
  -x "$NAME/data/*" \
  -x "$NAME/deploy/out/*" \
  -x "$NAME/*.log" \
  -x "$NAME/.DS_Store" \
  -x "$NAME/**/.DS_Store"

cp -f "$ZIP_STAMPED" "$ZIP_LATEST"

cat > "$OUT_DIR/DEPLOY-INSTRUCTIONS.txt" <<'EOF'
TOUBA TV — appttv — Déploiement VPS (stockage messages + photos)
=================================================================

1. Uploadez appttv-vps.zip vers /opt/toubatv/ sur votre serveur

2. Sur le VPS (SSH) :
   apt install -y unzip   # si absent
   mkdir -p /opt/toubatv && cd /opt/toubatv
   unzip -o appttv-vps.zip
   cd appttv

3. Secrets (une seule fois) :
   cp .env.example .env && nano .env
   # Renseigner : FIREBASE_WEB_APP_ID, VMIX_DS_TOKEN
   # Stockage VPS (activé par défaut) :
   #   VPS_STORAGE_ENABLED=true
   #   VPS_DATA_DIR=/opt/toubatv/appttv/data/vps
   #   GOOGLE_DRIVE_ENABLED=false
   # Placer service-account.json → /opt/toubatv/service-account.json

4. Installation :
   chmod +x scripts/*.sh
   ./scripts/install.sh
   ./scripts/post-install-vps.sh

5. Nginx (si pas déjà fait) :
   sudo cp deploy/nginx-includes/appttv.conf /etc/nginx/snippets/
   # Dans le vhost HTTPS stream.broadcastsn.com :
   #   include /etc/nginx/snippets/appttv.conf;
   sudo nginx -t && sudo systemctl reload nginx

6. Vérification :
   curl -s https://stream.broadcastsn.com/appttv/health
   # doit afficher "vpsStorage": true

URL admin : https://stream.broadcastsn.com/appttv
Guide stockage VPS : appttv/deploy/VPS-STORAGE.md
Guide complet : appttv/deploy/VPS-DEPLOIEMENT.md
EOF

BYTES="$(wc -c < "$ZIP_LATEST" | tr -d ' ')"
echo ""
echo "✓ ZIP créé :"
echo "  $ZIP_LATEST"
echo "  $ZIP_STAMPED"
echo "  Taille : $(( BYTES / 1024 )) Ko"
echo "  Instructions : $OUT_DIR/DEPLOY-INSTRUCTIONS.txt"
echo ""
echo "Upload :"
echo "  scp \"$ZIP_LATEST\" root@VOTRE_IP:/opt/toubatv/"
echo ""
echo "Sur le VPS :"
echo "  cd /opt/toubatv && unzip -o appttv-vps.zip && cd appttv && ./scripts/install.sh"
