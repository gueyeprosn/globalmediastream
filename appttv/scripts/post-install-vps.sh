#!/usr/bin/env bash
# Post-install sur VPS : nginx snippet + tests (après install.sh)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== TOUBA TV appttv — post-install VPS ==="

if [[ ! -f .env ]]; then
  echo "Erreur : .env manquant. cp .env.example .env && nano .env"
  exit 1
fi

if [[ ! -f "${GOOGLE_APPLICATION_CREDENTIALS:-/opt/toubatv/service-account.json}" ]]; then
  echo "⚠️  Manquant : /opt/toubatv/service-account.json"
  echo "   Téléchargez-le depuis Firebase Console (compte de service)."
fi

# Nginx snippet
if command -v nginx >/dev/null 2>&1; then
  SNIPPET_SRC="$ROOT/deploy/nginx-includes/appttv.conf"
  SNIPPET_DST="/etc/nginx/snippets/appttv.conf"
  if [[ -f "$SNIPPET_SRC" ]]; then
    if [[ -w /etc/nginx/snippets  ]] || [[ "$(id -u)" -eq 0 ]]; then
      cp "$SNIPPET_SRC" "$SNIPPET_DST"
      echo "→ Snippet copié : $SNIPPET_DST"
      echo "→ Ajoutez dans le server HTTPS stream.broadcastsn.com :"
      echo "     include /etc/nginx/snippets/appttv.conf;"
      if nginx -t 2>/dev/null; then
        echo "→ nginx -t OK (reload manuel si include déjà ajouté : systemctl reload nginx)"
      else
        echo "→ nginx -t : vérifiez le vhost principal (include pas encore ajouté ?)"
      fi
    else
      echo "→ Copiez manuellement :"
      echo "  sudo cp $SNIPPET_SRC $SNIPPET_DST"
    fi
  fi
else
  echo "⚠️  nginx non installé"
fi

# Health local
sleep 1
if curl -sf "http://127.0.0.1:${PORT:-3010}/appttv/health" >/dev/null 2>&1; then
  echo "✓ Health local OK (port ${PORT:-3010})"
else
  echo "⚠️  Health local KO — pm2 logs touba-appttv"
fi

echo ""
echo "Admin    : https://stream.broadcastsn.com/appttv"
echo "XML vMix : https://stream.broadcastsn.com/appttv/vmix/current.xml?token=VOTRE_TOKEN"
echo "Guide    : deploy/VPS-DEPLOIEMENT.md"
