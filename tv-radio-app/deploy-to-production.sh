#!/bin/bash

# ============================================================================
# Script de Déploiement Complet - Ocean FM Next.js → stream.broadcastsn.com
# ============================================================================

set -e

echo "=========================================="
echo "🚀 DÉPLOIEMENT PRODUCTION OCEAN FM"
echo "=========================================="
echo ""

# Variables
APP_DIR="/srv/tv-radio-app"
NODE_PORT=3000
SERVICE_NAME="oceanfm-app"
NGINX_CONFIG="/etc/nginx/sites-available/stream.broadcastsn.com"
NGINX_NEXTJS_CONFIG="/srv/global-media-streaming/config/nginx_nextjs.conf"

cd "$APP_DIR"

# Étape 1: Vérifications préalables
echo "[1/7] 🔍 Vérifications préalables..."

if [ ! -f "$APP_DIR/package.json" ]; then
    echo "❌ Erreur: package.json non trouvé"
    exit 1
fi

if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Attention: Ce script nécessite les droits root pour certaines opérations"
    echo "   Continuer quand même? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ Vérifications OK"

# Étape 2: Installation des dépendances
echo ""
echo "[2/7] 📦 Installation des dépendances..."
if [ ! -d "$APP_DIR/node_modules" ]; then
    npm install
else
    npm install --production=false
fi
echo "✅ Dépendances installées"

# Étape 3: Build de l'application
echo ""
echo "[3/7] 🔨 Build de l'application Next.js..."
npm run build

if [ ! -d "$APP_DIR/.next" ]; then
    echo "❌ Erreur: Le build a échoué"
    exit 1
fi

echo "✅ Build réussi"

# Étape 4: Installation de PM2 (si nécessaire)
echo ""
echo "[4/7] 📦 Vérification de PM2..."
if ! command -v pm2 &> /dev/null; then
    echo "Installation de PM2..."
    npm install -g pm2
else
    echo "✅ PM2 déjà installé"
fi

# Étape 5: Configuration PM2
echo ""
echo "[5/7] ⚙️  Configuration PM2..."

# Arrêter l'ancienne instance si elle existe
pm2 delete "$SERVICE_NAME" 2>/dev/null || true

# Démarrer la nouvelle instance
cd "$APP_DIR"
pm2 start npm --name "$SERVICE_NAME" -- start
pm2 save

# Configurer PM2 pour démarrer au boot
pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup

echo "✅ Application démarrée sur le port $NODE_PORT"

# Étape 6: Mise à jour de la configuration Nginx
echo ""
echo "[6/7] 🌐 Mise à jour de la configuration Nginx..."

if [ -f "$NGINX_CONFIG" ]; then
    # Créer une sauvegarde
    BACKUP_FILE="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$NGINX_CONFIG" "$BACKUP_FILE"
    echo "✅ Sauvegarde créée: $BACKUP_FILE"
    
    # Vérifier si la config Next.js est déjà présente
    if ! grep -q "proxy_pass http://127.0.0.1:3000" "$NGINX_CONFIG"; then
        echo "Ajout de la configuration Next.js..."
        
        # Trouver la ligne "# Site principal" et la remplacer
        if grep -q "# Site principal" "$NGINX_CONFIG"; then
            # Créer un fichier temporaire avec la nouvelle config
            sed -i '/# Site principal/,/try_files.*404/c\
    # Proxy pour l'\''application Next.js Ocean FM\
    location / {\
        proxy_pass http://127.0.0.1:'"$NODE_PORT"';\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection '\''upgrade'\'';\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_cache_bypass $http_upgrade;\
        proxy_connect_timeout 60s;\
        proxy_send_timeout 60s;\
        proxy_read_timeout 60s;\
        proxy_buffering off;\
        proxy_request_buffering off;\
    }\
    \
    # Fichiers statiques Next.js\
    location /_next/static {\
        proxy_pass http://127.0.0.1:'"$NODE_PORT"';\
        proxy_cache_valid 200 60m;\
        add_header Cache-Control "public, immutable";\
        expires 1y;\
    }\
    \
    # Images optimisées Next.js\
    location /_next/image {\
        proxy_pass http://127.0.0.1:'"$NODE_PORT"';\
        proxy_cache_valid 200 60m;\
    }' "$NGINX_CONFIG"
        else
            echo "⚠️  Section '# Site principal' non trouvée, ajout manuel nécessaire"
        fi
    else
        echo "✅ Configuration Next.js déjà présente"
    fi
    
    # Tester la configuration Nginx
    if nginx -t 2>/dev/null; then
        echo "✅ Configuration Nginx valide"
        systemctl reload nginx
        echo "✅ Nginx rechargé"
    else
        echo "❌ Erreur dans la configuration Nginx"
        echo "Restauration de la sauvegarde..."
        cp "$BACKUP_FILE" "$NGINX_CONFIG"
        exit 1
    fi
else
    echo "⚠️  Fichier de configuration Nginx non trouvé: $NGINX_CONFIG"
    echo "   Configuration manuelle nécessaire"
fi

# Étape 7: Vérification finale
echo ""
echo "[7/7] ✅ Vérification finale..."

sleep 2

# Vérifier que PM2 fonctionne
if pm2 list | grep -q "$SERVICE_NAME.*online"; then
    echo "✅ Application PM2 en cours d'exécution"
else
    echo "⚠️  Application PM2 non détectée comme 'online'"
    pm2 list
fi

# Test de connexion
if curl -s -o /dev/null -w "%{http_code}" http://localhost:$NODE_PORT | grep -q "200\|404"; then
    echo "✅ Application répond sur le port $NODE_PORT"
else
    echo "⚠️  L'application ne répond pas encore (peut prendre quelques secondes)"
fi

echo ""
echo "=========================================="
echo "🎉 DÉPLOIEMENT TERMINÉ!"
echo "=========================================="
echo ""
echo "📊 Statut de l'application:"
pm2 list | grep "$SERVICE_NAME" || echo "Vérifier: pm2 list"
echo ""
echo "📝 Commandes utiles:"
echo "  - Voir les logs: pm2 logs $SERVICE_NAME"
echo "  - Redémarrer: pm2 restart $SERVICE_NAME"
echo "  - Arrêter: pm2 stop $SERVICE_NAME"
echo "  - Status Nginx: systemctl status nginx"
echo ""
echo "🌐 Testez votre site: https://stream.broadcastsn.com"
echo ""
echo "⚠️  Si le site ne fonctionne pas:"
echo "  1. Vérifier les logs: pm2 logs $SERVICE_NAME"
echo "  2. Vérifier Nginx: tail -f /var/log/nginx/stream_ssl_error.log"
echo "  3. Vérifier le firewall: ufw status"
echo ""
