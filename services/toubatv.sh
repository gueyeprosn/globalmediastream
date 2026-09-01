#!/bin/bash

# Script de streaming ToubaTV
# SRT → FFmpeg → HLS (720p, optimisé VLC / apps)

HLS_DIR="/srv/toubatv/hls"
LOG_DIR="/srv/toubatv/logs"
STATE_DIR="/srv/toubatv/state"
SRT_PORT="6000"
MAX_RETRIES=999999
RETRY_DELAY=5
STALE_HLS_SEC="${STALE_HLS_SEC:-10}"
# Gel réel = aucun nouveau segment .ts produit depuis FREEZE_SEC (≈ 4 segments manqués)
FREEZE_SEC="${FREEZE_SEC:-18}"
WATCHDOG_INTERVAL="${WATCHDOG_INTERVAL:-3}"
KEEP_SEGMENTS="${KEEP_SEGMENTS:-72}"
FFMPEG_PRESET="${FFMPEG_PRESET:-veryfast}"
FFMPEG_THREADS="${FFMPEG_THREADS:-2}"
TARGET_FPS="${TARGET_FPS:-25}"
OUTPUT_WIDTH="${OUTPUT_WIDTH:-1280}"
OUTPUT_HEIGHT="${OUTPUT_HEIGHT:-720}"
HLS_SEGMENT_SEC="${HLS_SEGMENT_SEC:-4}"
SRT_LATENCY_MS="${SRT_LATENCY_MS:-12000}"
GOP_SIZE=$((TARGET_FPS * HLS_SEGMENT_SEC))
STALE_FLAG="$STATE_DIR/stale_restart"

mkdir -p "$HLS_DIR" "$LOG_DIR" "$STATE_DIR"

cleanup_old_segments() {
    local count
    count=$(find "$HLS_DIR" -name "segment_*.ts" -type f 2>/dev/null | wc -l)
    if [ "$count" -gt "$KEEP_SEGMENTS" ]; then
        find "$HLS_DIR" -name "segment_*.ts" -type f | sort -V | head -n "-$KEEP_SEGMENTS" | xargs rm -f 2>/dev/null || true
    fi
}

# Âge basé UNIQUEMENT sur index.m3u8 (les .ts peuvent bouger pendant un freeze manifest)
hls_playlist_age_sec() {
    local now mtime
    now=$(date +%s)
    if [ ! -f "$HLS_DIR/index.m3u8" ]; then
        echo 0
        return
    fi
    mtime=$(stat -c %Y "$HLS_DIR/index.m3u8" 2>/dev/null || echo 0)
    if [ "$mtime" -eq 0 ]; then
        echo 0
        return
    fi
    echo $((now - mtime))
}

# Âge du segment .ts le plus récent (signal fiable de production de contenu).
# Immunisé contre le comportement de MEDIA-SEQUENCE (qui reste à 0 tant que la
# playlist n'a pas dépassé hls_list_size segments).
newest_segment_age_sec() {
    local now newest
    now=$(date +%s)
    newest=$(find "$HLS_DIR" -name "segment_*.ts" -type f -printf '%T@\n' 2>/dev/null | sort -n | tail -1 | cut -d. -f1)
    if [ -z "$newest" ]; then
        echo 999
        return
    fi
    echo $((now - newest))
}

watchdog_hls() {
    local ffmpeg_pid="$1"
    # Délai de grâce au démarrage : laisser FFmpeg négocier le SRT et écrire
    # les premiers segments avant d'armer la détection de gel.
    local grace=0

    while kill -0 "$ffmpeg_pid" 2>/dev/null; do
        sleep "$WATCHDOG_INTERVAL"
        cleanup_old_segments
        grace=$((grace + WATCHDOG_INTERVAL))
        [ "$grace" -lt "$FREEZE_SEC" ] && continue

        local seg_age
        seg_age=$(newest_segment_age_sec)

        # Gel confirmé : aucun nouveau segment depuis FREEZE_SEC secondes.
        if [ "$seg_age" -gt "$FREEZE_SEC" ]; then
            echo "$(date '+%Y-%m-%d %H:%M:%S') - HLS figé (dernier segment il y a ${seg_age}s > ${FREEZE_SEC}s), redémarrage FFmpeg (pid $ffmpeg_pid)" >> "$LOG_DIR/ffmpeg.log"
            touch "$STALE_FLAG"
            kill -TERM "$ffmpeg_pid" 2>/dev/null
            sleep 2
            kill -KILL "$ffmpeg_pid" 2>/dev/null || true
            break
        fi
    done
}

RETRY_COUNT=0
while [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; do
    if [ "$RETRY_COUNT" -eq 0 ]; then
        rm -f "$HLS_DIR"/*.ts "$HLS_DIR"/*.m3u8
    else
        cleanup_old_segments
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Reconnexion tentative $RETRY_COUNT" >> "$LOG_DIR/ffmpeg.log"
    fi

    # Après freeze : nouveau manifest avec #EXT-X-DISCONTINUITY pour VLC
    if [ -f "$STALE_FLAG" ]; then
        rm -f "$HLS_DIR/index.m3u8" "$STALE_FLAG"
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Reprise après freeze HLS (manifest réinitialisé)" >> "$LOG_DIR/ffmpeg.log"
    fi

    ffmpeg -hide_banner -loglevel warning \
        -probesize 5000000 \
        -analyzeduration 5000000 \
        -fflags +genpts+discardcorrupt \
        -err_detect ignore_err \
        -rw_timeout 15000000 \
        -i "srt://0.0.0.0:${SRT_PORT}?mode=listener&latency=${SRT_LATENCY_MS}&rcvbuf=67108864&lossmaxttl=40&transtype=live&timeout=15000000" \
        -max_muxing_queue_size 4096 \
        -max_delay 5000000 \
        -vf "scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease:flags=fast_bilinear,pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1" \
        -c:v libx264 \
        -preset "$FFMPEG_PRESET" \
        -tune zerolatency \
        -profile:v main \
        -level 3.1 \
        -pix_fmt yuv420p \
        -threads "$FFMPEG_THREADS" \
        -thread_type slice \
        -r "$TARGET_FPS" \
        -crf 24 \
        -maxrate 1800k \
        -bufsize 3600k \
        -g "$GOP_SIZE" \
        -sc_threshold 0 \
        -keyint_min "$GOP_SIZE" \
        -x264-params "force-cfr=1:repeat-headers=1" \
        -c:a aac \
        -b:a 128k \
        -ar 44100 \
        -ac 2 \
        -af "aresample=44100:async=1000:min_hard_comp=0.100000" \
        -fps_mode cfr \
        -avoid_negative_ts make_zero \
        -max_interleave_delta 10000000 \
        -mpegts_flags +resend_headers+initial_discontinuity \
        -pcr_period 20 \
        -pat_period 0.1 \
        -f hls \
        -hls_time "$HLS_SEGMENT_SEC" \
        -hls_list_size 6 \
        -hls_flags independent_segments+program_date_time+temp_file+discont_start \
        -hls_segment_filename "$HLS_DIR/segment_%05d.ts" \
        -hls_allow_cache 0 \
        -start_number 0 \
        "$HLS_DIR/index.m3u8" \
        2>> "$LOG_DIR/ffmpeg.log" &

    FFMPEG_PID=$!
    watchdog_hls "$FFMPEG_PID" &
    WATCHDOG_PID=$!

    wait "$FFMPEG_PID"
    EXIT_CODE=$?

    kill "$WATCHDOG_PID" 2>/dev/null || true
    wait "$WATCHDOG_PID" 2>/dev/null || true

    RETRY_COUNT=$((RETRY_COUNT + 1))

    if [ "$EXIT_CODE" -eq 0 ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - FFmpeg terminé normalement (code: $EXIT_CODE)" >> "$LOG_DIR/ffmpeg.log"
        break
    fi

    echo "$(date '+%Y-%m-%d %H:%M:%S') - FFmpeg arrêté (code: $EXIT_CODE). Reconnexion dans ${RETRY_DELAY}s..." >> "$LOG_DIR/ffmpeg.log"
    sleep "$RETRY_DELAY"
done
