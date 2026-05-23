#!/bin/bash
# Script de rollback Pinguin BOAT

set -euo pipefail

DEPLOY_PATH="/opt/pinguinboat"
RELEASES_PATH="$DEPLOY_PATH/releases"
CURRENT_LINK="$DEPLOY_PATH/current"

echo "⏪ Rollback Pinguin BOAT"

# Get previous release
CURRENT=$(readlink -f "$CURRENT_LINK")
PREVIOUS=$(find "$RELEASES_PATH" -maxdepth 1 -type d | sort | tail -2 | head -1)

if [ -z "$PREVIOUS" ] || [ "$PREVIOUS" = "$CURRENT" ]; then
  echo "❌ Aucune release précédente trouvée."
  exit 1
fi

echo "📂 Current: $CURRENT"
echo "📂 Rollback vers: $PREVIOUS"

ln -sfn "$PREVIOUS" "$CURRENT_LINK"

echo "🔄 Redémarrage des services..."
pm2 restart pinguin-api pinguin-bot pinguin-web --update-env

echo "✅ Rollback terminé vers $PREVIOUS"
