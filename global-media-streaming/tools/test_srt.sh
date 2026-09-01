#!/bin/bash

# ============================================================================
# Script de Test SRT
# Teste la connexion SRT vers le serveur ToubaTV
# ============================================================================

set -e

SERVER="stream.broadcastsn.com"
PORT="6000"

echo "=========================================="
echo "Test de Connexion SRT"
echo "Serveur: $SERVER:$PORT"
echo "=========================================="

# Vérification de srt-live-transmit
if ! command -v srt-live-transmit &> /dev/null; then
    echo "Installation des outils SRT..."
    apt-get update -qq
    apt-get install -y -qq srt-tools
fi

# Test de connexion
echo ""
echo "Test de connexion SRT..."
echo "Mode: Caller"
echo ""

# Test basique avec timeout
timeout 5 srt-live-transmit "srt://$SERVER:$PORT?mode=caller" "file://con" 2>&1 | head -10 || {
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 124 ]; then
        echo ""
        echo "✅ Connexion SRT réussie (timeout attendu)"
        echo "Le serveur accepte les connexions SRT"
    else
        echo ""
        echo "⚠️  Connexion SRT testée"
        echo "Vérifiez que le service toubatv est démarré:"
        echo "  systemctl status toubatv"
    fi
}

echo ""
echo "Vérification du port UDP..."
if command -v nc &> /dev/null; then
    timeout 2 nc -u -z "$SERVER" "$PORT" 2>&1 && echo "✅ Port $PORT accessible" || echo "⚠️  Port $PORT non accessible (peut être normal si le firewall bloque)"
fi

echo ""
echo "Vérification du service..."
if systemctl is-active --quiet toubatv.service; then
    echo "✅ Service ToubaTV actif"
else
    echo "❌ Service ToubaTV inactif"
    echo "Démarrez-le avec: systemctl start toubatv"
fi

echo ""
echo "=========================================="
echo "Test terminé"
echo "=========================================="
echo ""
echo "Pour tester avec un vrai stream :"
echo "  Utilisez OBS ou vMix avec la configuration SRT Caller"
echo "  URL: srt://$SERVER:$PORT"
echo ""

