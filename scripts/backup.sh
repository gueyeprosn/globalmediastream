#!/bin/bash
# =======================================================
#    Global Media Streaming – Backup Automatique
#    Version PRO – Optimisée pour Ubuntu 24.04
# =======================================================

BACKUP_DIR="/srv/backups/globalmedia"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_${DATE}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

mkdir -p "$BACKUP_PATH"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "=== Début du backup Global Media ==="

# -------------------------------------------------------
# 📁 Sauvegarde des CONFIGURATIONS
# -------------------------------------------------------
log "Sauvegarde des configurations..."
mkdir -p "$BACKUP_PATH/config"

# Icecast
[ -f /etc/icecast2/icecast.xml ] && cp /etc/icecast2/icecast.xml "$BACKUP_PATH/config/"

# Nginx
[ -f /etc/nginx/sites-available/stream.broadcastsn.com ] \
    && cp /etc/nginx/sites-available/stream.broadcastsn.com "$BACKUP_PATH/config/"

[ -f /etc/nginx/conf.d/globalmedia-optimization.conf ] \
    && cp /etc/nginx/conf.d/globalmedia-optimization.conf "$BACKUP_PATH/config/"

# Systemd services
for svc in toubatv.service external-tv.service globalmedia-monitoring.service globalmedia-monitoring.timer
do
    [ -f /etc/systemd/system/$svc ] && cp /etc/systemd/system/$svc "$BACKUP_PATH/config/"
done

# -------------------------------------------------------
# 🧰 Sauvegarde des SCRIPTS
# -------------------------------------------------------
log "Sauvegarde des scripts..."
mkdir -p "$BACKUP_PATH/scripts"

[ -d /srv/global-media-streaming/scripts ] \
    && cp -r /srv/global-media-streaming/scripts/* "$BACKUP_PATH/scripts/"

[ -f /usr/local/bin/toubatv.sh ] && cp /usr/local/bin/toubatv.sh "$BACKUP_PATH/scripts/"
[ -f /usr/local/bin/external-tv.sh ] && cp /usr/local/bin/external-tv.sh "$BACKUP_PATH/scripts/"

# -------------------------------------------------------
# 🌐 Sauvegarde des FICHIERS WEB
# -------------------------------------------------------
log "Sauvegarde du site web..."
mkdir -p "$BACKUP_PATH/web"

if [ -d /var/www/globalmedia ]; then
    tar -czf "$BACKUP_PATH/web/globalmedia_web.tar.gz" \
        -C /var/www/globalmedia \
        --exclude='*.log' \
        --exclude='cache' \
        .
fi

# -------------------------------------------------------
# 📊 Sauvegarde des LOGS (7 derniers jours)
# -------------------------------------------------------
log "Sauvegarde des logs récents..."
mkdir -p "$BACKUP_PATH/logs"

find /var/log/nginx -name "*stream*" -mtime -7 -exec cp {} "$BACKUP_PATH/logs/" \; 2>/dev/null
find /var/log/icecast2 -mtime -7 -exec cp {} "$BACKUP_PATH/logs/" \; 2>/dev/null
find /var/log/globalmedia -mtime -7 -exec cp {} "$BACKUP_PATH/logs/" \; 2>/dev/null

# -------------------------------------------------------
# 📦 Création de l’archive .tar.gz
# -------------------------------------------------------
log "Compression de l'archive..."
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_PATH"

# -------------------------------------------------------
# 🧹 Nettoyage automatique (30 jours)
# -------------------------------------------------------
log "Nettoyage des backups > 30 jours..."
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete 2>/dev/null

# -------------------------------------------------------
# 📝 Infos finales
# -------------------------------------------------------
ARCHIVE_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | awk '{print $1}')
COUNT=$(ls "$BACKUP_DIR"/*.tar.gz 2>/dev/null | wc -l)

log "✓ Backup terminé : ${BACKUP_NAME}.tar.gz (${ARCHIVE_SIZE})"
log "✓ Nombre total de backups : ${COUNT}"
log "=== Fin du backup ==="