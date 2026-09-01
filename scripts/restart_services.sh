#!/bin/bash

# ============================================================================
# Script de Redémarrage des Services
# Global Media Streaming
# ============================================================================

set -e

echo "=========================================="
echo "Redémarrage des Services"
echo "Global Media Streaming"
echo "=========================================="

echo ""
echo "Redémarrage d'Icecast2..."
systemctl restart icecast2
sleep 2

echo "Redémarrage de ToubaTV..."
systemctl restart toubatv.service
sleep 2

echo "Redémarrage de Nginx..."
systemctl restart nginx
sleep 2

echo ""
echo "=========================================="
echo "✅ Tous les services ont été redémarrés"
echo "=========================================="
echo ""

# Affichage du statut
echo "Statut des services :"
echo ""
systemctl status icecast2 --no-pager -l | head -5 || true
echo ""
systemctl status toubatv.service --no-pager -l | head -5 || true
echo ""
systemctl status nginx --no-pager -l | head -5 || true
echo ""

