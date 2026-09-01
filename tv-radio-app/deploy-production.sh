#!/bin/bash

# ============================================================================
# Script de Déploiement Production - Ocean FM Next.js App
# Déploie l'application Next.js sur stream.broadcastsn.com
# ============================================================================

set -e

echo "=========================================="
echo "🚀 Déploiement Production Ocean FM"
echo "=========================================="

# Variables
APP_DIR="/srv/tv-radio-app"
DEPLOY_DIR="/var/www/globalmedia"
NODE_PORT=3000
SERVICE_NAME="oceanfm-app"

cd "$APP_DIR"

# Étape 1: Build de l'application
echo "[1/5] 📦 Build de l'application Next.js..."
npm run build

if [ ! -d "$APP_DIR/.next" ]; then
    echo "❌ Erreur: Le build a échoué"
    exit 1
fi

echo "✅ Build réussi"

# Étape 2: Créer le service systemd pour Next.js
echo "[2/5] 🔧 Configuration du service systemd..."

cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Ocean FM Next.js Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=$NODE_PORT
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Étape 3: Mettre à jour la configuration Nginx
echo "[3/5] 🌐 Mise à jour de la configuration Nginx..."

# Créer une sauvegarde de la config actuelle
if [ -f /etc/nginx/sites-available/stream.broadcastsn.com ]; then
    cp /etc/nginx/sites-available/stream.broadcastsn.com /etc/nginx/sites-available/stream.broadcastsn.com.backup.$(date +%Y%m%d_%H%M%S)
fi

# Ajouter la configuration proxy pour Next.js dans nginx_stream.conf
# (Cette partie sera ajoutée manuellement ou via un script séparé)

echo "✅ Configuration préparée"

# Étape 4: Installer PM2 (alternative plus robuste)
echo "[4/5] 📦 Installation de PM2 (optionnel mais recommandé)..."

if ! command -v pm2 &> /dev/null; then
    echo "Installation de PM2..."
    npm install -g pm2
else
    echo "✅ PM2 déjà installé"
fi

# Étape 5: Démarrer le service
echo "[5/5] 🚀 Démarrage du service..."

# Option 1: Utiliser systemd
systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}

# Option 2: Utiliser PM2 (décommenter si préféré)
# pm2 delete ${SERVICE_NAME} 2>/dev/null || true
# pm2 start npm --name ${SERVICE_NAME} -- start
# pm2 save
# pm2 startup

echo ""
echo "=========================================="
echo "✅ Déploiement terminé!"
echo "=========================================="
echo ""
echo "📝 Vérifications:"
echo "1. Service: systemctl status ${SERVICE_NAME}"
echo "2. Logs: journalctl -u ${SERVICE_NAME} -f"
echo "3. Test: curl http://localhost:$NODE_PORT"
echo ""
echo "⚠️  IMPORTANT: Mettre à jour Nginx pour proxy vers localhost:$NODE_PORT"
echo ""
