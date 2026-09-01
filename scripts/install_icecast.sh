#!/bin/bash

# ============================================================================
# Script d'Installation Icecast2
# Global Media Streaming - OceanFM
# ============================================================================

set -e

echo "=========================================="
echo "Installation Icecast2 pour OceanFM"
echo "=========================================="

# Installation d'Icecast2
echo "[1/5] Installation d'Icecast2..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq icecast2

# Activation d'Icecast2
echo "[2/5] Activation d'Icecast2..."
sed -i 's/ENABLE=false/ENABLE=true/' /etc/default/icecast2

# Sauvegarde de la configuration existante
ICECAST_CONFIG="/etc/icecast2/icecast.xml"
if [ -f "$ICECAST_CONFIG" ]; then
    cp "$ICECAST_CONFIG" "${ICECAST_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Création de la configuration complète
echo "[3/5] Configuration d'Icecast2..."
cat > "$ICECAST_CONFIG" << 'EOF'
<icecast>
    <location>Global Media</location>
    <admin>admin@broadcastsn.com</admin>
    
    <limits>
        <clients>100</clients>
        <sources>10</sources>
        <queue-size>524288</queue-size>
        <client-timeout>30</client-timeout>
        <header-timeout>15</header-timeout>
        <source-timeout>10</source-timeout>
        <burst-on-connect>1</burst-on-connect>
        <burst-size>65535</burst-size>
    </limits>

    <authentication>
        <source-password>CHANGE_ME_STRONG_SOURCE_PASSWORD</source-password>
        <relay-password>CHANGE_ME_STRONG_RELAY_PASSWORD</relay-password>
        <admin-user>admin</admin-user>
        <admin-password>CHANGE_ME_STRONG_ADMIN_PASSWORD</admin-password>
    </authentication>

    <hostname>stream.broadcastsn.com</hostname>
    <listen-socket>
        <port>8000</port>
        <bind-address>127.0.0.1</bind-address>
    </listen-socket>

    <mount>
        <mount-name>/oceanfm</mount-name>
        <username>source</username>
        <password>CHANGE_ME_STRONG_SOURCE_PASSWORD</password>
        <max-listeners>500</max-listeners>
        <dump-file>/var/log/icecast2/access.log</dump-file>
        <burst-size>65536</burst-size>
        <fallback-mount>/oceanfm</fallback-mount>
        <fallback-override>1</fallback-override>
        <fallback-when-full>1</fallback-when-full>
        <intro>/usr/share/icecast2/web/intro.mp3</intro>
        <hidden>0</hidden>
        <public>1</public>
        <stream-name>OceanFM - Global Media</stream-name>
        <stream-description>Radio streaming OceanFM - Global Media Broadcasting</stream-description>
        <stream-url>https://stream.broadcastsn.com</stream-url>
        <genre>Various</genre>
        <bitrate>128</bitrate>
        <metadata>1</metadata>
    </mount>

    <fileserve>1</fileserve>
    <paths>
        <basedir>/usr/share/icecast2</basedir>
        <logdir>/var/log/icecast2</logdir>
        <webroot>/usr/share/icecast2/web</webroot>
        <adminroot>/usr/share/icecast2/admin</adminroot>
        <alias source="/" dest="/status.xsl"/>
    </paths>

    <logging>
        <accesslog>access.log</accesslog>
        <errorlog>error.log</errorlog>
        <loglevel>3</loglevel>
        <logsize>10000</logsize>
        <logarchive>1</logarchive>
    </logging>

    <security>
        <chroot>0</chroot>
        <changeowner>
            <user>icecast2</user>
            <group>icecast2</group>
        </changeowner>
    </security>
</icecast>
EOF

# Création des dossiers de logs si nécessaire
echo "[4/5] Configuration des logs..."
mkdir -p /var/log/icecast2
ICECAST_USER=$(getent passwd icecast2 | cut -d: -f1)
ICECAST_GROUP=$(getent passwd icecast2 | cut -d: -f4)
ICECAST_GROUP_NAME=$(getent group $ICECAST_GROUP | cut -d: -f1)
chown -R $ICECAST_USER:$ICECAST_GROUP_NAME /var/log/icecast2 2>/dev/null || chown -R $ICECAST_USER:$ICECAST_GROUP /var/log/icecast2
chmod -R 755 /var/log/icecast2

# Démarrage et activation du service
echo "[5/5] Démarrage d'Icecast2..."
systemctl enable icecast2
systemctl restart icecast2

# Attente du démarrage
sleep 3

# Vérification du statut
if systemctl is-active --quiet icecast2; then
    echo ""
    echo "=========================================="
    echo "✅ Icecast2 installé et démarré avec succès !"
    echo "=========================================="
    echo ""
    echo "Configuration :"
    echo "  - Port: 8000 (interne)"
    echo "  - Mount: /oceanfm"
    echo "  - Hostname: stream.broadcastsn.com"
    echo "  - Mot de passe source: oceanfm_source_2024"
    echo "  - Mot de passe admin: oceanfm_admin_2024"
    echo ""
    echo "Admin Panel: http://stream.broadcastsn.com:8000/admin/"
    echo "Stream URL: http://stream.broadcastsn.com/oceanfm"
    echo ""
    systemctl status icecast2 --no-pager -l || true
else
    echo "❌ Erreur: Icecast2 n'a pas démarré correctement"
    journalctl -u icecast2 --no-pager -l | tail -20
    exit 1
fi

