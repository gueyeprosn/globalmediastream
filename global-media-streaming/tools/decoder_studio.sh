#!/bin/bash

# ============================================================================
# Script de Décodage pour Studio
# Global Media Streaming - Production Extérieure
# ============================================================================

STREAM_TYPE="$1"
STREAM_NAME="$2"

if [ -z "$STREAM_TYPE" ] || [ -z "$STREAM_NAME" ]; then
    echo "Usage: $0 [radio|tv] [oceanfm|external-radio|toubatv|external-tv]"
    echo ""
    echo "Exemples:"
    echo "  $0 radio external-radio    # Décoder la radio externe"
    echo "  $0 tv external-tv          # Décoder la TV externe"
    echo "  $0 radio oceanfm           # Décoder OceanFM"
    echo "  $0 tv toubatv              # Décoder ToubaTV"
    exit 1
fi

case "$STREAM_TYPE" in
    radio)
        case "$STREAM_NAME" in
            oceanfm)
                URL="https://stream.broadcastsn.com/oceanfm"
                ;;
            external-radio)
                URL="https://stream.broadcastsn.com/external-radio"
                ;;
            *)
                echo "❌ Stream radio inconnu: $STREAM_NAME"
                exit 1
                ;;
        esac
        
        echo "=========================================="
        echo "Décodage Radio: $STREAM_NAME"
        echo "URL: $URL"
        echo "=========================================="
        echo ""
        echo "Appuyez sur Ctrl+C pour arrêter"
        echo ""
        
        # Utiliser ffplay pour décoder et jouer
        if command -v ffplay &> /dev/null; then
            ffplay -nodisp -autoexit "$URL" 2>/dev/null || \
            ffplay "$URL"
        elif command -v mplayer &> /dev/null; then
            mplayer "$URL"
        elif command -v vlc &> /dev/null; then
            vlc "$URL"
        else
            echo "❌ Aucun lecteur trouvé. Installez ffplay, mplayer ou vlc"
            echo "Pour installer: sudo apt-get install ffmpeg vlc"
            exit 1
        fi
        ;;
        
    tv)
        case "$STREAM_NAME" in
            toubatv)
                URL="https://stream.broadcastsn.com/toubatv/index.m3u8"
                ;;
            external-tv)
                URL="https://stream.broadcastsn.com/external-tv/index.m3u8"
                ;;
            *)
                echo "❌ Stream TV inconnu: $STREAM_NAME"
                exit 1
                ;;
        esac
        
        echo "=========================================="
        echo "Décodage TV: $STREAM_NAME"
        echo "URL: $URL"
        echo "=========================================="
        echo ""
        echo "Appuyez sur Ctrl+C pour arrêter"
        echo ""
        
        # Utiliser ffplay pour décoder et afficher
        if command -v ffplay &> /dev/null; then
            ffplay "$URL"
        elif command -f vlc &> /dev/null; then
            vlc "$URL"
        else
            echo "❌ Aucun lecteur trouvé. Installez ffplay ou vlc"
            echo "Pour installer: sudo apt-get install ffmpeg vlc"
            exit 1
        fi
        ;;
        
    *)
        echo "❌ Type de stream inconnu: $STREAM_TYPE"
        echo "Utilisez 'radio' ou 'tv'"
        exit 1
        ;;
esac

