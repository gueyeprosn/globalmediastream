#!/bin/bash
# Diagnostic rapide du flux ToubaTV (port 6000 → HLS)

set -euo pipefail

HLS="/srv/toubatv/hls/index.m3u8"
HLS_DIR="/srv/toubatv/hls"
LOG="/srv/toubatv/logs/ffmpeg.log"
PUBLIC="https://stream.broadcastsn.com/toubatv/index.m3u8"
STALE_LIMIT=30

echo "=========================================="
echo "Test flux ToubaTV — $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "=========================================="
echo

# Service
if systemctl is-active --quiet toubatv.service; then
    echo "[OK] Service toubatv.service actif"
else
    echo "[ERREUR] Service toubatv.service inactif"
    exit 1
fi

# Port SRT
if ss -ulnp 2>/dev/null | grep -q ":6000"; then
    echo "[OK] Port UDP 6000 en écoute (SRT listener)"
    ss -ulnp | grep 6000
else
    echo "[ERREUR] Port 6000 non ouvert"
fi
echo

# HLS local
if [ -f "$HLS" ]; then
    mtime=$(stat -c %Y "$HLS")
    age=$(($(date +%s) - mtime))
    echo "[INFO] index.m3u8 — dernière MAJ il y a ${age}s"
    if [ "$age" -le "$STALE_LIMIT" ]; then
        echo "[OK] HLS en direct (fraîcheur < ${STALE_LIMIT}s)"
    else
        echo "[ALERTE] HLS figé (> ${STALE_LIMIT}s) — source SRT absente ou FFmpeg bloqué"
    fi
    echo "--- Playlist locale ---"
    head -12 "$HLS"
    echo
    latest=$(ls -t "$HLS_DIR"/segment_*.ts 2>/dev/null | head -1 || true)
    if [ -n "$latest" ]; then
        echo "--- Dernier segment: $(basename "$latest") ---"
        ffprobe -v error -select_streams v:0,a:0 \
            -show_entries stream=codec_name,width,height,r_frame_rate,bit_rate \
            -show_entries format=duration,size,bit_rate \
            -of default=nw=1 "$latest" 2>/dev/null || echo "[WARN] ffprobe segment échoué"
    fi
else
    echo "[INFO] Pas de index.m3u8 — en attente d'une connexion SRT (Caller)"
fi
echo

# HLS public
echo "--- URL publique ---"
code=$(curl -s -o /tmp/toubatv_test.m3u8 -w "%{http_code}" "$PUBLIC" || echo "000")
if [ "$code" = "200" ]; then
    echo "[OK] HTTP $code — $PUBLIC"
    head -8 /tmp/toubatv_test.m3u8
else
    echo "[ERREUR] HTTP $code sur $PUBLIC"
fi
echo

# Lecture 8s (si HLS frais)
if [ -f "$HLS" ] && [ "$age" -le "$STALE_LIMIT" ]; then
    echo "--- Test lecture 8 secondes ---"
    if timeout 15 ffmpeg -v error -i "$HLS" -t 8 -f null - 2>/tmp/toubatv_decode.err; then
        echo "[OK] Décodage HLS réussi (8s)"
    else
        echo "[ERREUR] Décodage HLS échoué:"
        cat /tmp/toubatv_decode.err
    fi
else
    echo "[SKIP] Test lecture — HLS non disponible ou figé"
fi
echo

# Erreurs récentes
echo "--- Dernières alertes logs ---"
grep -E 'HLS figé|Reconnexion|discontinuity|Packet corrupt|Error|No room' "$LOG" 2>/dev/null | tail -8 || echo "(aucune)"
echo
echo "=========================================="
echo "Fin du test"
echo "=========================================="
