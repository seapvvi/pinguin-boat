#!/bin/bash
# Script de mise à jour manuelle Pinguin BOAT

set -euo pipefail

DEPLOY_PATH="/opt/pinguinboat"
RELEASES_PATH="$DEPLOY_PATH/releases"
SHARED_PATH="$DEPLOY_PATH/shared"
CURRENT_LINK="$DEPLOY_PATH/current"
RELEASE_NAME="manual-$(date +%Y%m%d-%H%M%S)"
RELEASE_PATH="$RELEASES_PATH/$RELEASE_NAME"

echo "🔄 Mise à jour Pinguin BOAT"

# Get current version info
if [ -f "$CURRENT_LINK/package.json" ]; then
  CURRENT_VER=$(cat "$CURRENT_LINK/package.json" | grep '"version"' | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d ' ')
  echo "📦 Version actuelle : $CURRENT_VER"
fi

# Deploy
/opt/pinguinboat/current/scripts/deploy.sh "$RELEASE_NAME"

echo ""
echo "📦 Nouvelle release : $RELEASE_NAME"
echo "✅ Mise à jour terminée."
