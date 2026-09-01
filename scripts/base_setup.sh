#!/bin/bash

# ============================================================================
# Script de Configuration de Base du Serveur
# Global Media Streaming - Ubuntu 24.04
# ============================================================================

set -e

echo "=========================================="
echo "Configuration de Base du Serveur"
echo "Global Media Streaming"
echo "=========================================="

# Mise à jour du système
echo "[1/7] Mise à jour du système..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# Installation des paquets essentiels
echo "[2/7] Installation des paquets essentiels..."
apt-get install -y -qq \
    nginx \
    ffmpeg \
    fail2ban \
    ufw \
    curl \
    wget \
    git \
    certbot \
    python3-certbot-nginx \
    openssh-server \
    srt-tools \
    vim \
    htop \
    net-tools

# Configuration du Firewall
echo "[3/7] Configuration du firewall (UFW)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 8000/tcp comment 'Icecast2'
ufw allow 6000/udp comment 'SRT ToubaTV'
ufw --force enable

# Configuration SSH
echo "[4/7] Configuration SSH..."
SSH_CONFIG="/etc/ssh/sshd_config"

# Sauvegarde de la configuration existante
cp "$SSH_CONFIG" "${SSH_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"

# Modification de la configuration SSH (durcie : clés uniquement, pas de mot de passe)
sed -i 's/#PermitRootLogin.*/PermitRootLogin prohibit-password/' "$SSH_CONFIG"
sed -i 's/PermitRootLogin yes/PermitRootLogin prohibit-password/' "$SSH_CONFIG"
sed -i 's/#PasswordAuthentication.*/PasswordAuthentication no/' "$SSH_CONFIG"
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' "$SSH_CONFIG"

# Rechargement du service SSH
systemctl restart ssh || systemctl restart sshd || service ssh restart || service sshd restart
systemctl enable ssh 2>/dev/null || systemctl enable sshd 2>/dev/null || true

# Configuration Fail2ban
echo "[5/7] Configuration Fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# Création du dossier web
echo "[6/7] Création du dossier web..."
mkdir -p /var/www/globalmedia
cat > /var/www/globalmedia/index.html << 'EOF'
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Global Media Streaming</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .container {
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
        }
        h1 {
            font-size: 3em;
            margin-bottom: 20px;
        }
        .status {
            margin-top: 30px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 10px;
        }
        .link {
            color: #ffd700;
            text-decoration: none;
            font-weight: bold;
        }
        .link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌐 Global Media Streaming</h1>
        <p style="font-size: 1.2em;">Infrastructure de streaming professionnelle</p>
        <div class="status">
            <h2>Services Disponibles</h2>
            <p><strong>OceanFM Radio:</strong> <a href="/oceanfm" class="link">/oceanfm</a></p>
            <p><strong>ToubaTV Video:</strong> <a href="/toubatv/index.m3u8" class="link">/toubatv/index.m3u8</a></p>
        </div>
        <p style="margin-top: 30px; opacity: 0.8;">Serveur configuré et opérationnel</p>
    </div>
</body>
</html>
EOF

chown -R www-data:www-data /var/www/globalmedia
chmod -R 755 /var/www/globalmedia

# Vérification des services
echo "[7/7] Vérification des services..."
systemctl enable nginx
systemctl start nginx
systemctl status nginx --no-pager -l || true

echo ""
echo "=========================================="
echo "✅ Configuration de base terminée !"
echo "=========================================="
echo ""
echo "Prochaines étapes :"
echo "  1. Exécuter: ./scripts/install_icecast.sh"
echo "  2. Exécuter: ./scripts/install_toubatv.sh"
echo "  3. Configurer Nginx avec config/nginx_stream.conf"
echo "  4. Générer SSL avec: ./tools/generate_ssl.sh"
echo ""

