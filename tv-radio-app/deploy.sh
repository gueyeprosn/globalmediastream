#!/bin/bash

# ============================================================================
# Script de Déploiement - Ocean FM Next.js App
# Déploie l'application sur stream.broadcastsn.com
# ============================================================================

set -e

echo "=========================================="
echo "Déploiement Ocean FM Next.js App"
echo "=========================================="

# Variables
APP_DIR="/srv/tv-radio-app"
BUILD_DIR="$APP_DIR/.next"
DEPLOY_DIR="/var/www/globalmedia"
BACKUP_DIR="/var/www/globalmedia-backup-$(date +%Y%m%d_%H%M%S)"

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "$APP_DIR/package.json" ]; then
    echo "❌ Erreur: package.json non trouvé dans $APP_DIR"
    exit 1
fi

cd "$APP_DIR"

# Étape 1: Sauvegarder l'ancienne version
echo "[1/6] Sauvegarde de l'ancienne version..."
if [ -d "$DEPLOY_DIR" ] && [ "$(ls -A $DEPLOY_DIR)" ]; then
    mkdir -p "$(dirname $BACKUP_DIR)"
    cp -r "$DEPLOY_DIR" "$BACKUP_DIR"
    echo "✅ Sauvegarde créée: $BACKUP_DIR"
else
    echo "⚠️  Aucune version précédente à sauvegarder"
fi

# Étape 2: Installer les dépendances si nécessaire
echo "[2/6] Vérification des dépendances..."
if [ ! -d "$APP_DIR/node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install --production=false
else
    echo "✅ Dépendances déjà installées"
fi

# Étape 3: Build de l'application Next.js
echo "[3/6] Build de l'application Next.js..."
npm run build

if [ ! -d "$BUILD_DIR" ]; then
    echo "❌ Erreur: Le build a échoué, .next non trouvé"
    exit 1
fi

echo "✅ Build réussi"

# Étape 4: Préparer le répertoire de déploiement
echo "[4/6] Préparation du répertoire de déploiement..."
mkdir -p "$DEPLOY_DIR"

# Copier les fichiers statiques (public)
if [ -d "$APP_DIR/public" ]; then
    echo "📁 Copie des fichiers publics..."
    cp -r "$APP_DIR/public"/* "$DEPLOY_DIR/" 2>/dev/null || true
fi

# Étape 5: Copier les fichiers buildés
echo "[5/6] Copie des fichiers buildés..."

# Pour Next.js standalone (si configuré)
if [ -d "$BUILD_DIR/standalone" ]; then
    echo "📦 Mode standalone détecté"
    cp -r "$BUILD_DIR/standalone"/* "$DEPLOY_DIR/"
    cp -r "$BUILD_DIR/static" "$DEPLOY_DIR/.next/static" 2>/dev/null || true
else
    # Mode standard - copier .next et public
    echo "📦 Mode standard"
    mkdir -p "$DEPLOY_DIR/.next"
    cp -r "$BUILD_DIR"/* "$DEPLOY_DIR/.next/"
    
    # Copier les fichiers publics
    if [ -d "$APP_DIR/public" ]; then
        cp -r "$APP_DIR/public"/* "$DEPLOY_DIR/"
    fi
fi

# Créer un fichier .htaccess ou config pour Next.js si nécessaire
cat > "$DEPLOY_DIR/.htaccess" << 'EOF'
# Next.js Rewrite Rules
RewriteEngine On
RewriteBase /

# Handle Next.js static files
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /index.html [L]
EOF

# Étape 6: Configurer les permissions
echo "[6/6] Configuration des permissions..."
chown -R www-data:www-data "$DEPLOY_DIR" 2>/dev/null || chown -R nginx:nginx "$DEPLOY_DIR" 2>/dev/null || true
chmod -R 755 "$DEPLOY_DIR"

# Vérifier la configuration Nginx
echo ""
echo "=========================================="
echo "✅ Déploiement terminé avec succès!"
echo "=========================================="
echo ""
echo "📝 Prochaines étapes:"
echo "1. Vérifier que Nginx est configuré pour servir depuis: $DEPLOY_DIR"
echo "2. Tester: curl -I https://stream.broadcastsn.com"
echo "3. Redémarrer Nginx si nécessaire: systemctl reload nginx"
echo ""
echo "💾 Sauvegarde disponible: $BACKUP_DIR"
echo ""
