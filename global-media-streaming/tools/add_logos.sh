#!/bin/bash

# ============================================================================
# Script pour ajouter les logos à la page d'accueil
# Global Media Streaming
# ============================================================================

LOGOS_DIR="/var/www/globalmedia/logos"

echo "=========================================="
echo "Ajout des Logos"
echo "Global Media Streaming"
echo "=========================================="
echo ""

# Créer le dossier si nécessaire
mkdir -p "$LOGOS_DIR"

# Vérifier si des fichiers sont passés en argument
if [ $# -eq 0 ]; then
    echo "Usage: $0 [logo_globalmedia] [logo_oceanfm] [logo_toubatv]"
    echo ""
    echo "Exemple:"
    echo "  $0 globalmedia.png oceanfm.png toubatv.png"
    echo ""
    echo "Ou copiez manuellement vos logos dans: $LOGOS_DIR"
    echo ""
    echo "Noms attendus:"
    echo "  - globalmedia-logo.png"
    echo "  - oceanfm-logo.png"
    echo "  - toubatv-logo.png"
    exit 1
fi

# Copier les logos
if [ -n "$1" ] && [ -f "$1" ]; then
    cp "$1" "$LOGOS_DIR/globalmedia-logo.png"
    echo "✅ Logo Global Media copié"
fi

if [ -n "$2" ] && [ -f "$2" ]; then
    cp "$2" "$LOGOS_DIR/oceanfm-logo.png"
    echo "✅ Logo OceanFM copié"
fi

if [ -n "$3" ] && [ -f "$3" ]; then
    cp "$3" "$LOGOS_DIR/toubatv-logo.png"
    echo "✅ Logo ToubaTV copié"
fi

# Définir les permissions
chown -R www-data:www-data "$LOGOS_DIR"
chmod 644 "$LOGOS_DIR"/*.png 2>/dev/null || true

echo ""
echo "=========================================="
echo "✅ Logos ajoutés avec succès !"
echo "=========================================="
echo ""
echo "Vérifiez sur: https://stream.broadcastsn.com/"
echo ""

