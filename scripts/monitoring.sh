#!/bin/bash
# ===============================================
#   Global Media Streaming - Monitoring System
#   Version PRO - Optimisée pour Production
# ===============================================

LOG_DIR="/var/log/globalmedia"
LOG_FILE="$LOG_DIR/monitoring.log"
DOMAIN="stream.broadcastsn.com"

ALERT_EMAIL=""      # Email d'alerte (facultatif)
WEBHOOK_URL=""      # Webhook Discord/Slack/Telegram (facultatif)

mkdir -p "$LOG_DIR"

# -------------------------
# Fonction de log
# -------------------------
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# -------------------------
# Fonction d’alerte
# -------------------------
alert() {
    local msg="$1"
    log "🚨 ALERTE : $msg"

    # Webhook (Discord/Slack/Telegram)
    if [ -n "$WEBHOOK_URL" ]; then
        curl -m 3 -s -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"🚨 Alerte Global Media : $msg\"}" >/dev/null 2>&1
    fi

    # Email
    if [ -n "$ALERT_EMAIL" ]; then
        echo "$msg" | mail -s "Alerte Global Media" "$ALERT_EMAIL" || true
    fi
}

# -------------------------
# Vérification service systemd
# -------------------------
check_service() {
    local service="$1"
    local name="$2"

    if systemctl is-active --quiet "$service"; then
        log "✓ $name : OK"
    else
        alert "$name est arrêté !"
    fi
}

# -------------------------
# Vérification Icecast
# -------------------------
check_icecast() {
    if curl -m 3 -s -f http://127.0.0.1:8000/status-json.xsl >/dev/null ; then
        log "✓ Icecast : OK"
    else
        alert "Icecast ne répond plus"
    fi
}

# -------------------------
# Vérification Nginx
# -------------------------
check_nginx() {
    local domain="${DOMAIN:-stream.broadcastsn.com}"
    local code=$(curl -m 3 -s -o /dev/null -w "%{http_code}" https://$domain/ 2>/dev/null)

    if [ "$code" = "200" ] || [ "$code" = "301" ] || [ "$code" = "302" ]; then
        log "✓ Nginx : OK ($code)"
    else
        alert "Nginx répond en erreur ! (code $code)"
    fi
}

# -------------------------
# Vérification disque
# -------------------------
check_disk() {
    local seuil=85
    local usage=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')

    if [ "$usage" -gt "$seuil" ]; then
        alert "Espace disque critique : ${usage}% utilisé"
    else
        log "✓ Disque : ${usage}% utilisé"
    fi
}

# -------------------------
# Vérification mémoire
# -------------------------
check_memory() {
    local seuil=90
    local mem=$(free | awk '/Mem:/ {printf "%.0f", $3/$2*100}')

    if [ "$mem" -gt "$seuil" ]; then
        alert "Mémoire saturée : ${mem}%"
    else
        log "✓ Mémoire : ${mem}%"
    fi
}

# -------------------------
# Vérification HLS
# -------------------------
check_hls() {
    declare -A streams=(
        ["/srv/toubatv/hls/index.m3u8"]="ToubaTV"
        ["/srv/external-tv/hls/index.m3u8"]="External TV"
    )

    for path in "${!streams[@]}"; do
        name="${streams[$path]}"

        if [ ! -f "$path" ]; then
            alert "$name : fichier HLS introuvable"
            continue
        fi

        age=$(($(date +%s) - $(stat -c %Y "$path")))

        if [ "$age" -gt 60 ]; then
            alert "$name : stream arrêté depuis ${age}s"
        else
            log "✓ $name : Stream actif"
        fi
    done
}

# -------------------------
# Vérification listeners Icecast
# -------------------------
check_listeners() {
    local json=$(curl -s http://127.0.0.1:8000/status-json.xsl)

    if [ -z "$json" ]; then
        log "⚠ Impossible de récupérer les listeners Icecast"
        return
    fi

    local total=$(echo "$json" | grep -oP '"listeners"\s*:\s*\K[0-9]+' | awk '{s+=$1} END {print s}')

    log "🎧 Listeners Icecast : ${total:-0}"
}

# -------------------------
# Nettoyage log (rotation simple)
# -------------------------
rotate_log() {
    MAX_SIZE=5000000  # 5 Mo
    if [ -f "$LOG_FILE" ] && [ $(stat -c%s "$LOG_FILE") -gt $MAX_SIZE ]; then
        mv "$LOG_FILE" "$LOG_FILE.old"
        touch "$LOG_FILE"
        log "🔄 Rotation du fichier de log"
    fi
}

# -----------------------------------
# Exécution complète du monitoring
# -----------------------------------
log "=== Début du monitoring ==="

rotate_log

check_service "nginx" "Nginx"
check_service "icecast2" "Icecast2"
check_service "toubatv.service" "ToubaTV"
check_service "external-tv.service" "External TV"

check_nginx
check_icecast
check_disk
check_memory
check_hls
check_listeners

log "=== Fin du monitoring ==="