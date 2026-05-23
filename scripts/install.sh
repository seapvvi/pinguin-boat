#!/bin/bash
# Script d'installation initiale de Pinguin BOAT
# À exécuter en tant que root sur un serveur Debian 12

set -euo pipefail

echo "═══════════════════════════════════════════════"
echo "  Pinguin BOAT - Installation initiale"
echo "  Forgé pour la communauté"
echo "═══════════════════════════════════════════════"
echo ""

# Vérification root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Ce script doit être exécuté en tant que root."
  exit 1
fi

# Configuration
INSTALL_DIR="/opt/pinguinboat"
GIT_REPO="${GIT_REPO:-}"
NODE_VERSION="20"
DOMAIN="${DOMAIN:-}"

echo "📦 Mise à jour du système..."
apt update && apt upgrade -y

echo "📦 Installation des dépendances système..."
apt install -y curl wget git build-essential nginx postgresql postgresql-contrib certbot python3-certbot-nginx

echo "📦 Installation de Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt install -y nodejs

echo "📦 Installation de pnpm..."
npm install -g pnpm

echo "📦 Installation de PM2..."
npm install -g pm2

echo "📂 Création de l'arborescence..."
mkdir -p "$INSTALL_DIR/releases"
mkdir -p "$INSTALL_DIR/shared/logs"
mkdir -p "$INSTALL_DIR/shared/uploads"
mkdir -p "$INSTALL_DIR/backups"
mkdir -p "$INSTALL_DIR/current"

echo "👤 Création de l'utilisateur pinguin..."
id -u pinguin &>/dev/null || useradd -m -s /bin/bash -G www-data pinguin
chown -R pinguin:pinguin "$INSTALL_DIR"

echo "🐘 Configuration de PostgreSQL..."
sudo -u postgres psql -c "CREATE USER pinguin WITH PASSWORD '$(openssl rand -base64 24)';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE pinguinboat OWNER pinguin;" 2>/dev/null || true
echo "✅ Base de données PostgreSQL configurée"
echo "ℹ️  Mot de passe généré aléatoirement. Consultez les logs pour le retrouver."

echo ""
echo "═══════════════════════════════════════════════"
echo "  Installation terminée !"
echo "═══════════════════════════════════════════════"
echo ""
echo "Prochaines étapes :"
echo "  1. Clonez le dépôt : git clone <url> /opt/pinguinboat/releases/initial"
echo "  2. Copiez .env.example en .env et configurez-le"
echo "  3. Liez la release : ln -sfn /opt/pinguinboat/releases/initial /opt/pinguinboat/current"
echo "  4. Exécutez : pnpm install && pnpm build"
echo "  5. Exécutez : pnpm db:migrate"
echo "  6. Configurez PM2 : pm2 start /opt/pinguinboat/current/deploy/pm2.config.json"
echo "  7. Configurez Nginx : cp deploy/nginx.conf /etc/nginx/sites-available/pinguinboat"
echo "  8. Obtenez SSL : certbot --nginx -d votredomaine.com"
echo "  9. Redémarrez : systemctl restart nginx && pm2 save && pm2 startup"
echo ""
