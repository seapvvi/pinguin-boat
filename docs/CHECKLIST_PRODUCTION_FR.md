# Checklist de mise en production — Pinguin BOAT

> Liste de vérification complète pour s'assurer que l'instance est prête pour la production.

---

## 1. Sécurité

### 1.1 Fichier .env

- [ ] Le fichier `.env` est correctement protégé
- [ ] `chmod 600 /opt/pinguinboat/shared/.env` (lecture uniquement par le propriétaire)
- [ ] Le fichier `.env` n'est **pas** dans un dépôt Git
- [ ] `SESSION_SECRET` fait au moins 64 caractères et est généré aléatoirement
- [ ] `DISCORD_TOKEN` est valide et non expiré
- [ ] `DISCORD_OWNER_ID` correspond à votre ID Discord personnel

### 1.2 Authentification

- [ ] **2FA obligatoire** configuré et vérifié pour le panel owner
- [ ] L'URL de redirection OAuth2 sur le portail Discord est correcte
- [ ] Les scopes OAuth2 sont limités à `identify` et `guilds`
- [ ] `DISCORD_CLIENT_SECRET` est unique et non partagé

### 1.3 HTTPS et Nginx

- [ ] Le certificat SSL Let's Encrypt est valide (vérifier avec `certbot certificates`)
- [ ] Le renouvellement automatique est configuré (timer systemd `certbot.timer`)
- [ ] La redirection HTTP → HTTPS fonctionne (code 301)
- [ ] Les headers de sécurité sont présents dans la réponse :

```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 1.4 Rate limiting

- [ ] Le rate limiting Nginx est actif : 30 req/s avec burst 20
- [ ] Le rate limiting Fastify est actif : 100 req/min par IP
- [ ] Les limites sont adaptées à votre volume d'utilisateurs

### 1.5 Pare-feu

- [ ] Seuls les ports 80 (HTTP), 443 (HTTPS) et 22 (SSH) sont ouverts
- [ ] PostgreSQL n'est pas accessible depuis l'extérieur (port 5432 en local)
- [ ] `ufw status` montre les règles correctes

---

## 2. Base de données

### 2.1 Migrations

- [ ] Toutes les migrations Prisma sont appliquées : `pnpm db:migrate status`
- [ ] Le client Prisma est généré : `pnpm db:generate`
- [ ] Les tables sont créées : `psql -U pinguin -d pinguinboat -c "\dt"`
- [ ] Les données initiales sont peuplées : `pnpm db:seed`

### 2.2 Backups automatiques

- [ ] Le script `backup.sh` fonctionne : `bash /opt/pinguinboat/current/scripts/backup.sh`
- [ ] Une tâche cron est configurée :
  ```cron
  0 3 * * * /opt/pinguinboat/current/scripts/backup.sh >> /var/log/pinguin-backup.log 2>&1
  ```
- [ ] Les backups sont accessibles dans `/opt/pinguinboat/backups/`
- [ ] La rotation des backups (30 jours) est active
- [ ] Le fichier de backup est bien au format `pinguinboat-backup-*.sql.gz`
- [ ] Tester une restauration : `gunzip -c backup.sql.gz | psql -U pinguin -d pinguinboat`

### 2.3 Index

- [ ] Les index Prisma sont créés automatiquement par les migrations
- [ ] Vérifier les index lourds : `\di` dans psql
- [ ] Les champs fréquemment recherchés (guildId, userId, discordId) sont indexés

### 2.4 Performances

- [ ] `shared_buffers` PostgreSQL est configuré (25% de la RAM)
- [ ] `effective_cache_size` est configuré (50% de la RAM)
- [ ] Les connexions max sont suffisantes : `max_connections = 50` minimum

---

## 3. Performances

### 3.1 PM2

- [ ] Les services PM2 sont en ligne : `pm2 status`
- [ ] `pinguin-web` utilise le mode **cluster** avec 2 instances
- [ ] `pinguin-api` et `pinguin-bot` sont en mode **fork**
- [ ] `pm2 startup` est activé (redémarrage automatique au boot)
- [ ] Les limites mémoire sont configurées (API : 500MB, Bot : 800MB, Web : 500MB)
- [ ] Les logs PM2 sont écrits dans `/opt/pinguinboat/shared/logs/`
- [ ] `max_restarts` et `restart_delay` sont configurés

### 3.2 Cache Nginx

- [ ] La compression gzip est activée
- [ ] Les types MIME gzip sont configurés (text, css, json, javascript, etc.)
- [ ] La mise en cache des fichiers statiques est active (365 jours)
- [ ] Les assets Next.js `/_next/static` sont en cache avec `public, immutable`

### 3.3 Build

- [ ] Le build est optimisé (production) : `NODE_ENV=production`
- [ ] Turborepo cache les builds intermédiaires
- [ ] Les sources maps ne sont pas exposées en production

---

## 4. Monitoring

### 4.1 Logs centralisés

- [ ] Les logs PM2 sont écrits dans `/opt/pinguinboat/shared/logs/`
- [ ] Les logs de Nginx sont dans `/var/log/nginx/`
- [ ] Les logs applicatifs sont en format `json` en production (optionnel)

### 4.2 Healthcheck

- [ ] Le script `healthcheck.sh` retourne ✅ pour tous les services
- [ ] Un cron vérifie la santé toutes les 5 minutes :
  ```cron
  */5 * * * * /opt/pinguinboat/current/scripts/healthcheck.sh || /opt/pinguinboat/current/scripts/healthcheck.sh | mail -s "ALERTE" admin@example.com
  ```
- [ ] L'endpoint `/api/health` répond correctement

### 4.3 Alertes

- [ ] Mettre en place un système d'alerte (email, Discord webhook) en cas de service down
- [ ] Surveiller l'espace disque (logs + backups)
- [ ] Surveiller la mémoire RAM et CPU

---

## 5. Déploiement

### 5.1 Script deploy.sh

- [ ] Le script `deploy.sh` a été testé avec un déploiement de test
- [ ] Les variables GIT sont configurées : `GITHUB_REPO`, `GITHUB_BRANCH`
- [ ] Le token GitHub est valide si le dépôt est privé
- [ ] Le déploiement fonctionne depuis le panel owner

### 5.2 Rollback

- [ ] Le script `rollback.sh` fonctionne : il bascule vers la release précédente
- [ ] Le rollback depuis le panel owner a été testé
- [ ] Au moins 2 releases sont présentes dans `/opt/pinguinboat/releases/`
- [ ] Après rollback, les services redémarrent correctement

### 5.3 Symlink atomique

- [ ] Le lien `/opt/pinguinboat/current` existe et pointe vers une release
- [ ] Le swap de symlink utilise `ln -sfn` + `mv -Tf` (atomique)
- [ ] Les fichiers partagés (`.env`, logs) sont bien liés symboliquement

### 5.4 Fichiers partagés

- [ ] `.env` est bien dans `shared/` et lié à chaque release
- [ ] Les logs sont centralisés dans `shared/logs/`
- [ ] Les uploads sont dans `shared/uploads/`

---

## 6. Bot Discord

### 6.1 Intents

- [ ] **Presence Intent** activé sur le portail développeur Discord
- [ ] **Server Members Intent** activé
- [ ] **Message Content Intent** activé

### 6.2 Permissions

- [ ] Les permissions du bot incluent : `Manage Roles`, `Kick`, `Ban`, `Manage Channels`, etc.
- [ ] Le bot a le scope `applications.commands` (commandes slash)

### 6.3 Commandes slash

- [ ] Les commandes sont enregistrées : le bot répond à `/ping`
- [ ] Les commandes globales sont synchronisées (peut prendre jusqu'à 1 heure)
- [ ] Les commandes sont testées dans un salon textuel

### 6.4 État du bot

- [ ] Le bot est en ligne (pastille verte sur Discord)
- [ ] L'activité s'affiche correctement : `🏔️ Pinguin BOAT | /help`
- [ ] Le bot répond aux messages privés (DM) si nécessaire

---

## 7. Dashboard

### 7.1 OAuth2

- [ ] Les URLs de redirection OAuth2 sont configurées sur le portail Discord
- [ ] L'URL de redirection correspond à `NEXT_PUBLIC_DISCORD_REDIRECT_URI`
- [ ] La connexion avec Discord fonctionne de bout en bout

### 7.2 Sessions

- [ ] Les sessions sont stockées côté API (cookie signé)
- [ ] `SESSION_SECRET` est une chaîne aléatoire de ≥ 64 caractères
- [ ] `SESSION_MAX_AGE` est configuré (7 jours par défaut)
- [ ] Les sessions expirent correctement

### 7.3 Thèmes

- [ ] Les 10 thèmes sont disponibles et fonctionnels
- [ ] Les thèmes sont persistés par utilisateur (localStorage)
- [ ] Les variables CSS de thème sont correctement injectées
- [ ] L'accessibilité (contraste) est respectée pour tous les thèmes

### 7.4 Panel owner

- [ ] Le 2FA est configuré et fonctionnel
- [ ] Les métriques système s'affichent (CPU, RAM, uptime)
- [ ] La liste des serveurs et utilisateurs s'affiche
- [ ] La blacklist fonctionne (ajout/suppression)
- [ ] Les logs d'actions owner sont visibles

---

## 8. Scripts à vérifier

| Script           | Chemin                                               | Vérification                              |
|------------------|------------------------------------------------------|-------------------------------------------|
| `install.sh`     | `scripts/install.sh`                                 | Installation complète du serveur          |
| `deploy.sh`      | `scripts/deploy.sh`                                  | Déploiement d'une release                 |
| `rollback.sh`    | `scripts/rollback.sh`                                | Rollback vers release précédente          |
| `update.sh`      | `scripts/update.sh`                                  | Mise à jour manuelle                      |
| `backup.sh`      | `scripts/backup.sh`                                  | Backup PostgreSQL                          |
| `healthcheck.sh` | `scripts/healthcheck.sh`                             | Vérification des 3 services               |

Chaque script doit être :

- [ ] Exécutable : `chmod +x scripts/*.sh`
- [ ] Testé : exécution sans erreur
- [ ] Documenté : les commentaires expliquent le fonctionnement

---

## 9. PM2

### 9.1 Configuration

- [ ] `deploy/pm2.config.json` est valide (vérifier avec `pm2 start --no-daemon`)
- [ ] `pinguin-api` : script `apps/api/dist/apps/api/src/index.js`, mode fork, 1 instance
- [ ] `pinguin-bot` : script `apps/bot/dist/index.js`, mode fork, 1 instance
- [ ] `pinguin-web` : script `apps/web/server.js`, mode cluster, 2 instances

### 9.2 Démarrage automatique

- [ ] `pm2 save` a été exécuté (liste des processus sauvegardée)
- [ ] `pm2 startup` a été exécuté (génération du script systemd)
- [ ] Le service PM2 systemd est actif : `systemctl status pm2-pinguin`

### 9.3 Logs

- [ ] Les fichiers de log existent dans `/opt/pinguinboat/shared/logs/`
- [ ] Les logs sont rotés (PM2 gère la rotation par défaut)
- [ ] `pm2 logs` affiche les logs des 3 services

---

## 10. Nginx

### 10.1 Configuration

- [ ] La configuration Nginx est valide : `nginx -t`
- [ ] Le fichier de config est lié dans `sites-enabled`
- [ ] Les `upstream` (pinguin-web, pinguin-api) pointent vers les bons ports
- [ ] Les chemins SSL pointent vers les certificats Let's Encrypt
- [ ] Les protocoles SSL sont limités à TLSv1.2 et TLSv1.3

### 10.2 SSL

- [ ] Le certificat SSL est valide : `certbot certificates`
- [ ] La date d'expiration est dans plus de 30 jours
- [ ] Le renouvellement automatique est actif : `systemctl list-timers | grep certbot`

### 10.3 Rate limiting

- [ ] La zone de rate limiting `pinguin` est définie (10m, 30r/s)
- [ ] Le rate limiting est appliqué sur les routes `/api/`
- [ ] Le burst de 20 requêtes est configuré

---

## 11. Vérification finale

### 11.1 Test utilisateur

- [ ] Ouvrir `https://votre-domaine.com` dans un navigateur
- [ ] Se connecter avec Discord
- [ ] Le dashboard affiche les informations du profil
- [ ] Les serveurs sont listés avec leurs configurations
- [ ] Tester `/ping` sur Discord → réponse reçue

### 11.2 Test de résilience

- [ ] `pm2 stop pinguin-api` → le healthcheck détecte l'arrêt
- [ ] `pm2 start pinguin-api` → le service redémarre
- [ ] `systemctl restart nginx` → le site reste accessible après quelques secondes
- [ ] Redémarrer le serveur → tous les services redémarrent automatiquement

### 11.3 Test de sécurité

- [ ] `curl -I http://votre-domaine.com` → redirige vers HTTPS (301)
- [ ] `curl -I https://votre-domaine.com` → headers de sécurité présents
- [ ] Accéder à `/api/owner/stats` sans authentification → 401
- [ ] Accéder au panel owner sans être l'owner → refusé

---

## 12. Checklist récapitulative rapide

- [ ] ✅ Installation terminée (Debian 12, Node 20, pnpm, PostgreSQL)
- [ ] ✅ Bot en ligne sur Discord (pastille verte)
- [ ] ✅ Dashboard accessible en HTTPS
- [ ] ✅ Connexion OAuth2 Discord fonctionnelle
- [ ] ✅ Commandes slash enregistrées et fonctionnelles
- [ ] ✅ Panel owner accessible avec 2FA
- [ ] ✅ Déploiement et rollback testés
- [ ] ✅ Backups automatiques configurés
- [ ] ✅ Healthcheck opérationnel
- [ ] ✅ PM2 startup activé
- [ ] ✅ Certificat SSL valide et renouvellement automatique
- [ ] ✅ Pare-feu configuré (ports 80, 443, 22 uniquement)
- [ ] ✅ `.env` protégé (chmod 600)

---

> Félicitations ! Votre instance de Pinguin BOAT est prête pour la production. Consultez la documentation dans `docs/` pour les opérations courantes.
