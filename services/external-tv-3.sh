#!/bin/bash

# Script de relay SRT to SRT - Stream 3
# Port 6005 : Reçoit le stream SRT entrant
# Port 6006 : Redistribue le stream SRT en sortie
# Mode: SRT Listener (6005) → SRT Listener (6006)

LOG_DIR="/srv/external-tv-3/logs"
SRT_INPUT_PORT="6005"
SRT_OUTPUT_PORT="6006"

# Création des dossiers si nécessaire
mkdir -p "$LOG_DIR"

# Relay SRT to SRT avec srt-live-transmit
# Mode listener sur 6005 (reçoit le stream entrant)
# Mode listener sur 6006 (redistribue le stream - attend une connexion caller)
# Note: Syntaxe "srt://:PORT" pour listener (écoute sur toutes les interfaces)
srt-live-transmit \
    -ll info \
    -stats-report-frequency 1000 \
    -logfile "$LOG_DIR/srt-relay.log" \
    "srt://:${SRT_INPUT_PORT}?mode=listener&latency=4000&rcvlatency=4000&peerlatency=4000&peeridletimeo=10000&rcvbuf=16000000&transtype=live" \
    "srt://:${SRT_OUTPUT_PORT}?mode=listener&latency=2000&rcvlatency=2000&peerlatency=2000&peeridletimeo=10000&transtype=live" \
    >> "$LOG_DIR/srt-relay.log" 2>&1
