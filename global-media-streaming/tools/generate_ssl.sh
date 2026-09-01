#!/bin/bash

# ============================================================================
# Script de Génération SSL avec Let's Encrypt
# Global Media Streaming
# ============================================================================

set -e

DOMAIN="stream.broadcastsn.com"
EMAIL="admin@broadcastsn.com"

echo "=========================================="
echo "Génération du Certificat SSL"
echo "Domain: $DOMAIN"
echo "=========================================="

# Vérification de Certbot
if ! command -v certbot &> /dev/null; then
    echo "Installation de Certbot..."
    apt-get update -qq
    apt-get install -y -qq certbot python3-certbot-nginx
fi

# Vérification que le domaine pointe vers ce serveur
echo "Vérification DNS..."
IP=$(dig +short $DOMAIN A | tail -n1)
SERVER_IP=$(curl -4 -s ifconfig.me || curl -4 -s icanhazip.com || hostname -I | awk '{print $1}')

if [ -z "$IP" ]; then
    echo "❌ Erreur: Impossible de résoudre $DOMAIN"
    echo "Assurez-vous que le domaine pointe vers ce serveur"
    exit 1
fi

echo "IP du domaine: $IP"
echo "IP du serveur: $SERVER_IP"

if [ "$IP" != "$SERVER_IP" ]; then
    echo "⚠️  Attention: L'IP du domaine ($IP) ne correspond pas à l'IP du serveur ($SERVER_IP)"
    echo "Vérification en cours..."
    # Vérifier si le serveur répond sur le domaine
    if curl -s --connect-timeout 5 "http://$DOMAIN" > /dev/null 2>&1; then
        echo "✅ Le serveur répond sur $DOMAIN, continuation..."
    else
        echo "❌ Le serveur ne répond pas sur $DOMAIN"
        echo "Assurez-vous que le domaine pointe vers ce serveur avant de continuer"
        exit 1
    fi
fi

# Génération du certificat
echo ""
echo "Génération du certificat SSL..."
certbot certonly --nginx \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    --expand

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ Certificat SSL généré avec succès !"
    echo "=========================================="
    echo ""
    echo "Prochaines étapes :"
    echo "  1. Modifier /etc/nginx/sites-available/stream.broadcastsn.com"
    echo "  2. Décommenter la section HTTPS"
    echo "  3. Décommenter la redirection HTTP vers HTTPS"
    echo "  4. Tester: nginx -t"
    echo "  5. Recharger: systemctl reload nginx"
    echo ""
    echo "Renouvellement automatique configuré via cron"
    echo ""
else
    echo ""
    echo "❌ Erreur lors de la génération du certificat"
    echo "Vérifiez que :"
    echo "  - Le domaine pointe vers ce serveur"
    echo "  - Le port 80 est ouvert"
    echo "  - Nginx est configuré et accessible"
    exit 1
fi

