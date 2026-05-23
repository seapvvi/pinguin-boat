#!/bin/bash
# Script de déploiement Pinguin BOAT
# Usage: ./scripts/deploy.sh <release_name>

set -euo pipefail

RELEASE_NAME="${1:-release-$(date +%Y%m%d-%H%M%S)}"
DEPLOY_PATH="/opt/pinguinboat"
RELEASES_PATH="$DEPLOY_PATH/releases"
SHARED_PATH="$DEPLOY_PATH/shared"
CURRENT_LINK="$DEPLOY_PATH/current"
RELEASE_PATH="$RELEASES_PATH/$RELEASE_NAME"
GIT_REPO="${GIT_REPO:-}"
GIT_BRANCH="${GIT_BRANCH:-main}"

echo "🚀 Déploiement Pinguin BOAT - $RELEASE_NAME"
echo "═══════════════════════════════════════════"

# 1. Cloner
echo "📥 Clonage de $GIT_REPO ($GIT_BRANCH)..."
git clone --depth 1 --branch "$GIT_BRANCH" "$GIT_REPO" "$RELEASE_PATH"

# 2. Lier les fichiers partagés
echo "🔗 Liaison des fichiers partagés..."
if [ -f "$SHARED_PATH/.env" ]; then
  ln -sf "$SHARED_PATH/.env" "$RELEASE_PATH/.env"
fi

# 3. Installer dépendances
echo "📦 Installation des dépendances..."
cd "$RELEASE_PATH"
pnpm install --frozen-lockfile

# 4. Générer Prisma
echo "🗄️  Génération Prisma..."
pnpm db:generate

# 5. Build
echo "🔨 Build..."
pnpm build

# 6. Lier .env Prisma
cp "$RELEASE_PATH/.env" "$RELEASE_PATH/packages/db/.env" 2>/dev/null || true

# 7. Migrations (mode production = non interactif)
echo "🗄️  Migrations..."
cd "$RELEASE_PATH/packages/db" && npx prisma migrate deploy && cd "$RELEASE_PATH"

# 8. Swap symlink
echo "🔄 Activation de la nouvelle release..."
ln -sfn "$RELEASE_PATH" "$CURRENT_LINK.new"
mv -Tf "$CURRENT_LINK.new" "$CURRENT_LINK"

# 9. Redémarrer services
echo "🔄 Redémarrage des services..."
pm2 restart pinguin-api pinguin-bot pinguin-web --update-env

echo "✅ Déploiement terminé avec succès !"
