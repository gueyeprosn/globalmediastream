#!/usr/bin/env bash
# Arrête tout processus Next qui écoute sur 3000 (zombie hors PM2), puis redémarre l’app PM2.
set -euo pipefail
PORT="${PORT:-3000}"
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
else
  for pid in $(ss -tlnp 2>/dev/null | grep ":${PORT} " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u); do
    [ -n "${pid}" ] && kill "${pid}" 2>/dev/null || true
  done
fi
sleep 1
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart oceanfm-app --update-env || pm2 start npm --name oceanfm-app -- start
else
  echo "pm2 absent: lancez npm start à la main dans /srv/tv-radio-app"
  exit 1
fi
echo "OK — vérifiez: curl -sS -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:${PORT}/"
