#!/bin/bash

# ============================================================================
# Script d'Installation ToubaTV (SRT → FFmpeg → HLS)
# Global Media Streaming
# ============================================================================

set -e

echo "=========================================="
echo "Installation ToubaTV Streaming"
echo "=========================================="

# Vérification de FFmpeg
echo "[1/6] Vérification de FFmpeg..."
if ! command -v ffmpeg &> /dev/null; then
    echo "Installation de FFmpeg..."
    apt-get update -qq
    apt-get install -y -qq ffmpeg
fi

FFMPEG_VERSION=$(ffmpeg -version | head -n1)
echo "FFmpeg installé: $FFMPEG_VERSION"

# Installation des outils SRT
echo "[2/6] Installation des outils SRT..."
apt-get install -y -qq srt-tools

# Création des dossiers
echo "[3/6] Création des dossiers..."
mkdir -p /srv/toubatv/hls
mkdir -p /srv/toubatv/logs
chmod -R 755 /srv/toubatv

# Création du script de streaming
echo "[4/6] Création du script de streaming ToubaTV..."
cat > /usr/local/bin/toubatv.sh << 'SCRIPTEOF'
#!/bin/bash

# Script de streaming ToubaTV
# SRT → FFmpeg → HLS

HLS_DIR="/srv/toubatv/hls"
LOG_DIR="/srv/toubatv/logs"
SRT_PORT="6000"

# Nettoyage des anciens segments HLS
rm -f "$HLS_DIR"/*.ts "$HLS_DIR"/*.m3u8

# Pipeline FFmpeg : SRT → 720p → HLS
ffmpeg -hide_banner -loglevel warning \
    -fflags +genpts+igndts+discardcorrupt+flush_packets \
    -err_detect ignore_err \
    -i "srt://0.0.0.0:${SRT_PORT}?mode=listener&latency=8000&rcvbuf=33554432&transtype=live" \
    -max_muxing_queue_size 1024 \
    -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25" \
    -c:v libx264 \
    -preset veryfast \
    -tune zerolatency \
    -profile:v main \
    -level 3.1 \
    -pix_fmt yuv420p \
    -crf 24 \
    -maxrate 1800k \
    -bufsize 3600k \
    -g 100 \
    -sc_threshold 0 \
    -keyint_min 100 \
    -af aresample=async=1:min_hard_comp=0.100000:first_pts=0 \
    -fps_mode cfr \
    -c:a aac \
    -b:a 128k \
    -ar 44100 \
    -ac 2 \
    -f hls \
    -hls_time 4 \
    -hls_list_size 10 \
    -hls_delete_threshold 6 \
    -hls_flags delete_segments+independent_segments+program_date_time \
    -hls_segment_filename "$HLS_DIR/segment_%05d.ts" \
    -hls_allow_cache 0 \
    -start_number 0 \
    "$HLS_DIR/index.m3u8" \
    >> "$LOG_DIR/ffmpeg.log" 2>&1
SCRIPTEOF

chmod +x /usr/local/bin/toubatv.sh

# Création du service systemd
echo "[5/6] Création du service systemd..."
cat > /etc/systemd/system/toubatv.service << 'SERVICEEOF'
[Unit]
Description=ToubaTV Streaming Service (SRT to HLS)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/srv/toubatv
ExecStart=/usr/local/bin/toubatv.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Limites de ressources
LimitNOFILE=65536
MemoryMax=500M
CPUQuota=60%
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7

# Variables d'environnement
Environment="FFREPORT=file=/srv/toubatv/logs/ffmpeg_report.log:level=32"

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Rechargement de systemd et démarrage du service
echo "[6/6] Démarrage du service ToubaTV..."
systemctl daemon-reload
systemctl enable toubatv.service
systemctl start toubatv.service

# Attente du démarrage
sleep 3

# Vérification du statut
if systemctl is-active --quiet toubatv.service; then
    echo ""
    echo "=========================================="
    echo "✅ ToubaTV installé et démarré avec succès !"
    echo "=========================================="
    echo ""
    echo "Configuration :"
    echo "  - Port SRT: 6000 (UDP)"
    echo "  - Dossier HLS: /srv/toubatv/hls"
    echo "  - Logs: /srv/toubatv/logs"
    echo "  - Service: toubatv.service"
    echo ""
    echo "URL de streaming: https://stream.broadcastsn.com/toubatv/index.m3u8"
    echo ""
    echo "Configuration OBS/vMix SRT Caller:"
    echo "  URL: srt://stream.broadcastsn.com:6000"
    echo "  Mode: Caller"
    echo ""
    systemctl status toubatv.service --no-pager -l || true
else
    echo "❌ Erreur: Le service ToubaTV n'a pas démarré correctement"
    journalctl -u toubatv.service --no-pager -l | tail -20
    exit 1
fi

