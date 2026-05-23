# Guide d'installation de Pinguin BOAT

> Version : 0.1.0-alpha | Plateforme : Debian 12 | Node.js ≥ 20

---

## 1. Prérequis

### Matériel minimum

| Ressource   | Requis                     |
|-------------|----------------------------|
| OS          | Debian 12 (bookworm)       |
| RAM         | 2 Go (4 Go recommandé)     |
| Stockage    | 10 Go d'espace libre       |
| CPU         | 2 cœurs                    |
| Connexion   | Accès Internet permanent   |

### Domaines et DNS

- Un domaine (ou sous-domaine) pointant vers l'adresse IP du serveur
- Enregistrement DNS de type A configuré (exemple : `bot.votredomaine.com`)
- Ports 80 (HTTP) et 443 (HTTPS) ouverts dans le pare-feu

### Logiciels requis

Le script d'installation se charge de tout installer automatiquement :

- Node.js 20.x LTS
- pnpm 9.x
- PM2 (gestionnaire de processus)
- PostgreSQL 15+
- Nginx
- Certbot + plugin Nginx (Let's Encrypt)
- Git
- Build essentials (gcc, make)

---

## 2. Installation automatique (recommandée)

### Étape 1 : Connexion au serveur

```bash
ssh root@votredomaine.com
```

### Étape 2 : Télécharger et exécuter le script d'installation

```bash
# Option A : déposer le script sur le serveur
scp scripts/install.sh root@votredomaine.com:/root/install.sh
ssh root@votredomaine.com
chmod +x install.sh
./install.sh

# Option B : exécution directe depuis le dépôt
curl -fsSL https://raw.githubusercontent.com/username/pinguin-boat/main/scripts/install.sh | bash
```

### Étape 3 : Cloner le dépôt

```bash
git clone https://github.com/username/pinguin-boat.git /opt/pinguinboat/releases/initial
```

### Étape 4 : Copier et configurer le fichier .env

```bash
cp /opt/pinguinboat/releases/initial/.env.example /opt/pinguinboat/.env
nano /opt/pinguinboat/.env
```

Remplissez toutes les variables (voir section 6).

### Étape 5 : Lier la release courante

```bash
ln -sfn /opt/pinguinboat/releases/initial /opt/pinguinboat/current
```

### Étape 6 : Installer les dépendances et builder

```bash
cd /opt/pinguinboat/current
pnpm install --frozen-lockfile
pnpm build
```

### Étape 7 : Appliquer les migrations Prisma

```bash
pnpm db:generate
pnpm db:migrate
```

### Étape 8 : Démarrer les services PM2

```bash
pm2 start /opt/pinguinboat/current/deploy/pm2.config.json
pm2 save
pm2 startup
```

### Étape 9 : Configurer Nginx et le SSL

```bash
cp /opt/pinguinboat/current/deploy/nginx.conf /etc/nginx/sites-available/pinguinboat
```

Éditez le fichier pour remplacer `votredomaine.com` par votre domaine :

```bash
sed -i 's/votredomaine.com/votre-domaine.com/g' /etc/nginx/sites-available/pinguinboat
ln -sf /etc/nginx/sites-available/pinguinboat /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

Obtenez le certificat SSL :

```bash
certbot --nginx -d votre-domaine.com
```

### Étape 10 : Vérification finale

```bash
pm2 status
curl http://localhost:4000/api/health
curl https://votre-domaine.com/api/health
```

---

## 3. Installation manuelle

Si le script automatique ne convient pas, voici les étapes manuelles.

### 3.1 Mise à jour du système

```bash
apt update && apt upgrade -y
```

### 3.2 Installation des dépendances

```bash
apt install -y curl wget git build-essential nginx postgresql postgresql-contrib certbot python3-certbot-nginx
```

### 3.3 Installation de Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v  # >= 20.0.0
```

### 3.4 Installation de pnpm

```bash
npm install -g pnpm
pnpm --version  # >= 9.0.0
```

### 3.5 Installation de PM2

```bash
npm install -g pm2
pm2 --version
```

### 3.6 Création de l'utilisateur dédié

```bash
useradd -m -s /bin/bash -G www-data pinguin
```

### 3.7 Création de l'arborescence

```bash
mkdir -p /opt/pinguinboat/releases
mkdir -p /opt/pinguinboat/shared/logs
mkdir -p /opt/pinguinboat/shared/uploads
mkdir -p /opt/pinguinboat/backups
mkdir -p /opt/pinguinboat/current
chown -R pinguin:pinguin /opt/pinguinboat
```

---

## 4. Configuration de PostgreSQL

### Création de l'utilisateur et de la base

```bash
sudo -u postgres psql
```

Dans le shell PostgreSQL :

```sql
CREATE USER pinguin WITH PASSWORD 'mot_de_passe_fort';
CREATE DATABASE pinguinboat OWNER pinguin;
GRANT ALL PRIVILEGES ON DATABASE pinguinboat TO pinguin;
\q
```

### Tester la connexion

```bash
psql -U pinguin -d pinguinboat -h localhost
```

### Configuration de la variable d'environnement

```
DATABASE_URL=postgresql://pinguin:mot_de_passe_fort@localhost:5432/pinguinboat
```

---

## 5. Configuration de Nginx + SSL

### Fichier de configuration Nginx

Le fichier modèle se trouve dans `deploy/nginx.conf`. Voici les points clés :

- **Proxy inverse** : redirige les requêtes vers le dashboard (port 3000) et l'API (port 4000)
- **Rate limiting** : 30 requêtes/seconde avec burst de 20
- **Headers de sécurité** : X-Frame-Options, X-Content-Type-Options, etc.
- **Gzip** : compression activée pour les assets
- **Cache** : les fichiers statiques sont mis en cache 365 jours
- **WebSocket** : support pour la musique en temps réel

### Obtenir le certificat SSL

```bash
certbot --nginx -d votre-domaine.com
```

Renouvellement automatique (certbot crée un timer systemd) :

```bash
certbot renew --dry-run
```

### Vérifier la configuration

```bash
nginx -t
systemctl restart nginx
```

---

## 6. Variables d'environnement

| Variable                            | Obligatoire | Description                                              | Valeur par défaut            |
|-------------------------------------|-------------|----------------------------------------------------------|------------------------------|
| `DISCORD_CLIENT_ID`                 | Oui         | ID de l'application Discord                              | —                            |
| `DISCORD_CLIENT_SECRET`             | Oui         | Secret de l'application Discord                          | —                            |
| `DISCORD_TOKEN`                     | Oui         | Token du bot Discord                                     | —                            |
| `DISCORD_OWNER_ID`                  | Oui         | ID Discord du propriétaire (accès panel owner)           | —                            |
| `DISCORD_PUBLIC_KEY`                | Oui         | Clé publique Discord (pour les webhooks)                 | —                            |
| `DATABASE_URL`                      | Oui         | URL de connexion PostgreSQL                              | —                            |
| `SESSION_SECRET`                    | Oui         | Clé secrète pour les sessions (min 64 caractères)        | —                            |
| `SESSION_MAX_AGE`                   | Non         | Durée de vie des sessions en secondes                    | `604800` (7 jours)           |
| `API_HOST`                          | Non         | Hôte d'écoute de l'API                                   | `0.0.0.0`                   |
| `API_PORT`                          | Non         | Port d'écoute de l'API                                   | `4000`                       |
| `API_URL`                           | Oui         | URL publique de l'API                                    | —                            |
| `CORS_ORIGIN`                       | Non         | Origine CORS autorisée                                   | `http://localhost:3000`      |
| `NEXT_PUBLIC_API_URL`               | Oui         | URL de l'API pour le dashboard                           | —                            |
| `NEXT_PUBLIC_DISCORD_CLIENT_ID`     | Oui         | ID client Discord pour OAuth2                            | —                            |
| `NEXT_PUBLIC_DISCORD_REDIRECT_URI`  | Oui         | URL de redirection OAuth2                                | —                            |
| `NEXT_PUBLIC_SITE_URL`              | Oui         | URL publique du dashboard                                | —                            |
| `BOT_ACTIVITY_TYPE`                 | Non         | Type d'activité Discord (0=Jouer, 2=Écouter, 3=Regarder)| `3`                          |
| `BOT_ACTIVITY_NAME`                 | Non         | Texte d'activité du bot                                  | `🏔️ Pinguin BOAT \| /help` |
| `YOUTUBE_COOKIE`                    | Non         | Cookie YouTube (évite restrictions)                      | —                            |
| `SPOTIFY_CLIENT_ID`                 | Non         | Client ID Spotify pour la musique                        | —                            |
| `SPOTIFY_CLIENT_SECRET`             | Non         | Client Secret Spotify                                    | —                            |
| `SOUNDCLOUD_CLIENT_ID`              | Non         | Client ID SoundCloud                                     | —                            |
| `GITHUB_REPO`                       | Oui*        | Dépot GitHub (utilisateur/repo)                          | —                            |
| `GITHUB_BRANCH`                     | Non         | Branche de déploiement                                   | `main`                       |
| `GITHUB_TOKEN`                      | Non         | Token GitHub (nécessaire si dépôt privé)                 | —                            |
| `DEPLOY_PATH`                       | Non         | Chemin racine de déploiement                             | `/opt/pinguinboat`           |
| `DEPLOY_RELEASES_PATH`              | Non         | Chemin des releases                                      | `.../releases`               |
| `DEPLOY_SHARED_PATH`                | Non         | Chemin des fichiers partagés                             | `.../shared`                 |
| `DEPLOY_BACKUPS_PATH`               | Non         | Chemin des backups                                       | `.../backups`                |
| `DEPLOY_CURRENT_LINK`               | Non         | Chemin du lien symbolique courant                        | `.../current`                |
| `ALPHA_ALL_FREE`                    | Non         | Mode alpha : tout gratuit                                | `true`                       |
| `PREMIUM_ENABLED`                   | Non         | Activer le système premium                               | `false`                      |
| `LOG_LEVEL`                         | Non         | Niveau de log (debug, info, warn, error)                 | `info`                       |
| `LOG_FORMAT`                        | Non         | Format des logs (pretty, json)                           | `pretty`                     |

> *Obligatoire uniquement si vous utilisez le déploiement automatique depuis le panel owner.

---

## 7. Vérification du bon fonctionnement

### Healthcheck basique

```bash
curl http://localhost:4000/api/health
```

Réponse attendue :

```json
{ "status": "ok", "timestamp": "2025-01-01T00:00:00.000Z" }
```

### Via le script de healthcheck

```bash
bash /opt/pinguinboat/current/scripts/healthcheck.sh
```

### Vérifier les processus PM2

```bash
pm2 status
```

Vous devez voir trois processus : `pinguin-api`, `pinguin-bot`, `pinguin-web`.

### Vérifier les logs

```bash
pm2 logs pinguin-api --lines 20
pm2 logs pinguin-bot --lines 20
pm2 logs pinguin-web --lines 20
```

### Vérifier la base de données

```bash
psql -U pinguin -d pinguinboat -c "\dt"
```

### Vérifier Nginx

```bash
curl -I https://votre-domaine.com
```

Code de statut attendu : `200 OK` ou `302 Found` (redirection vers Discord OAuth2).

### Vérification complète depuis le navigateur

1. Accédez à `https://votre-domaine.com`
2. La page doit rediriger vers Discord pour l'authentification OAuth2
3. Après connexion, le tableau de bord s'affiche
4. Le bot doit apparaître en ligne sur Discord

---

## 8. Dépannage

### Le bot ne se connecte pas

- Vérifiez `DISCORD_TOKEN` dans le `.env`
- Vérifiez que le token n'a pas expiré (regénérer sur le portail développeur Discord)
- Consultez les logs : `pm2 logs pinguin-bot`

### L'API refuse de démarrer

- Vérifiez que PostgreSQL est en cours d'exécution : `systemctl status postgresql`
- Vérifiez que `DATABASE_URL` est correcte
- Vérifiez les logs : `pm2 logs pinguin-api`

### Erreur de connexion à la base de données

- Assurez-vous que l'utilisateur PostgreSQL a les droits suffisants
- Vérifiez que PostgreSQL écoute sur `localhost` : `ss -tlnp | grep 5432`
- Dans `/etc/postgresql/15/main/postgresql.conf`, vérifiez `listen_addresses = 'localhost'`

### Certificat SSL expiré

```bash
certbot renew
systemctl reload nginx
```

### Ports non accessibles

```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload
```

---

> **Prochaine étape** : Consultez `ACTIVATION_BOT_FR.md` pour configurer votre application Discord et activer le bot sur votre serveur.
