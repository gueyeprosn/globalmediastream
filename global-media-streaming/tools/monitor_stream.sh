#!/bin/bash

# ============================================================================
# Script de Monitoring des Streams
# Global Media Streaming
# ============================================================================

echo "=========================================="
echo "Monitoring des Streams"
echo "Global Media Streaming"
echo "=========================================="

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📻 OCEANFM (Icecast2)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if systemctl is-active --quiet icecast2; then
    echo "✅ Service Icecast2: ACTIF"
    echo ""
    echo "Statut du service:"
    systemctl status icecast2 --no-pager -l | head -8
    echo ""
    echo "Dernières lignes des logs:"
    tail -5 /var/log/icecast2/error.log 2>/dev/null || echo "Aucun log disponible"
    echo ""
    echo "Test de connexion au mount:"
    curl -s -I http://127.0.0.1:8000/oceanfm | head -3 || echo "Mount non accessible"
else
    echo "❌ Service Icecast2: INACTIF"
    echo "Démarrez avec: systemctl start icecast2"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📺 TOUBATV (SRT → HLS)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if systemctl is-active --quiet toubatv.service; then
    echo "✅ Service ToubaTV: ACTIF"
    echo ""
    echo "Statut du service:"
    systemctl status toubatv.service --no-pager -l | head -8
    echo ""
    echo "Dernières lignes des logs FFmpeg:"
    tail -10 /srv/toubatv/logs/ffmpeg.log 2>/dev/null || echo "Aucun log disponible"
    echo ""
    echo "Fichiers HLS générés:"
    ls -lh /srv/toubatv/hls/*.m3u8 /srv/toubatv/hls/*.ts 2>/dev/null | tail -5 || echo "Aucun fichier HLS trouvé"
    echo ""
    echo "Test du fichier HLS:"
    if [ -f /srv/toubatv/hls/index.m3u8 ]; then
        echo "✅ index.m3u8 existe"
        echo "Contenu:"
        head -5 /srv/toubatv/hls/index.m3u8
    else
        echo "⚠️  index.m3u8 non trouvé (le stream n'a peut-être pas encore démarré)"
    fi
else
    echo "❌ Service ToubaTV: INACTIF"
    echo "Démarrez avec: systemctl start toubatv"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 NGINX"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if systemctl is-active --quiet nginx; then
    echo "✅ Service Nginx: ACTIF"
    echo ""
    echo "Statut du service:"
    systemctl status nginx --no-pager -l | head -5
    echo ""
    echo "Test de configuration:"
    nginx -t 2>&1 | tail -2
else
    echo "❌ Service Nginx: INACTIF"
    echo "Démarrez avec: systemctl start nginx"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RÉSUMÉ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Comptage des processus
FFMPEG_COUNT=$(pgrep -c ffmpeg || echo "0")
ICECAST_COUNT=$(pgrep -c icecast2 || echo "0")

echo "Processus FFmpeg actifs: $FFMPEG_COUNT"
echo "Processus Icecast2 actifs: $ICECAST_COUNT"
echo ""

# Ports ouverts
echo "Ports en écoute:"
netstat -tuln 2>/dev/null | grep -E ':(6000|8000|80|443)' || ss -tuln 2>/dev/null | grep -E ':(6000|8000|80|443)'

echo ""
echo "=========================================="
echo "Monitoring terminé"
echo "=========================================="
echo ""

