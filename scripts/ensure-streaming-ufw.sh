#!/usr/bin/env bash
# Règles firewall type « plateforme streaming » (UDP 6000–6100 SRT + services courants).
# À lancer en root si ufw est actif : bash scripts/ensure-streaming-ufw.sh

set -euo pipefail

if ! command -v ufw >/dev/null 2>&1; then
  echo "ufw non installé, abandon."
  exit 0
fi

ufw allow 6000:6100/udp comment 'SRT dynamic range' || true
ufw allow 1935/tcp comment 'RTMP' || true
ufw allow 1985/tcp comment 'SRS API' || true
ufw allow 8080/tcp comment 'SRS HTTP' || true
ufw allow 8000/udp comment 'SRS media UDP' || true
ufw allow 2022/tcp comment 'Oryx' || true

echo "Règles ufw proposées (vérifiez avec: ufw status numbered)"
