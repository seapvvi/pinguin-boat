# Activation du bot Pinguin BOAT sur Discord

> Guide complet pour créer une application Discord, configurer le bot, et le rendre opérationnel.

---

## 1. Créer une application sur le portail développeur Discord

1. Rendez-vous sur https://discord.com/developers/applications
2. Cliquez sur **New Application**
3. Donnez un nom à votre application (ex. : `Pinguin BOAT`)
4. Acceptez les conditions d'utilisation
5. Cliquez sur **Create**

### 1.1 Configurer l'identité du bot

Dans le menu de gauche, cliquez sur **General Information** :

- **App Icon** : Téléchargez le logo de Pinguin BOAT (pingouin à couronne)
- **Description** : « Pinguin BOAT — Bot Discord multifonction : modération, musique, économie, niveaux, giveaways, tickets, et bien plus. Forgé pour la communauté. »

### 1.2 Récupérer les identifiants

Depuis **General Information** :

- `Application ID` → `DISCORD_CLIENT_ID`
- `Public Key` → `DISCORD_PUBLIC_KEY`

Depuis **OAuth2 > General** :

- `Client Secret` → `DISCORD_CLIENT_SECRET` (cliquez sur **Reset Secret** si nécessaire)

---

## 2. Configurer le bot

### 2.1 Créer le bot

1. Dans le menu de gauche, cliquez sur **Bot**
2. Cliquez sur **Add Bot** puis **Yes, do it!**
3. Sous **Token**, cliquez sur **Reset Token** puis **Copy**
   - Ce token → `DISCORD_TOKEN` dans votre `.env`
   - **Ne partagez jamais ce token** — il donne un contrôle total sur le bot

### 2.2 Activer les intents (obligatoire)

Dans la section **Privileged Gateway Intents** du menu Bot, activez TOUS les intents suivants :

- ✅ **Presence Intent** — requis pour les statuts utilisateur
- ✅ **Server Members Intent** — requis pour la modération et les levels
- ✅ **Message Content Intent** — requis pour les commandes basées sur le préfixe et l'auto-modération

> Sans ces intents, des fonctionnalités majeures du bot ne fonctionneront pas.

### 2.3 Permissions du bot

Le bot nécessite les permissions suivantes (calculées automatiquement via le portail) :

| Permission                     | Utilité                            |
|--------------------------------|------------------------------------|
| `Manage Roles`                 | Automodération, giveaways, tickets |
| `Kick Members`                 | Sanctions                          |
| `Ban Members`                  | Sanctions                          |
| `Manage Channels`              | Tickets, logs, verrouillage        |
| `Manage Messages`              | Purge, giveaways                   |
| `Read Message History`         | Analyse des messages               |
| `Moderate Members`             | Timeouts                           |
| `Send Messages`                | Communication                      |
| `Embed Links`                  | Envoi d'embeds                     |
| `Attach Files`                 | Logs, transcriptions               |
| `Connect / Speak`              | Musique                            |
| `Use Voice Activities`         | Activités vocales                  |

---

## 3. Inviter le bot sur un serveur

### 3.1 Générer l'URL d'invitation

Depuis le portail développeur Discord, sous **OAuth2 > URL Generator** :

1. **Scopes** : cochez `bot` et `applications.commands`
2. **Bot Permissions** : cochez les permissions listées ci-dessus (ou utilisez le code de permissions calculé : `275146356800`)
3. L'URL générée ressemble à :

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&permissions=275146356800&scope=bot+applications.commands
```

### 3.2 Inviter

1. Ouvrez l'URL dans un navigateur
2. Sélectionnez le serveur destinataire (vous devez avoir la permission `Manage Server`)
3. Cliquez sur **Continuer** puis **Autoriser**
4. Complétez le **captcha**

> **Limitation** : Le bot peut être invité sur un maximum de 100 serveurs sans vérification. Au-delà, une vérification Discord est requise.

---

## 4. Renseigner le fichier .env

```bash
cd /opt/pinguinboat/current
cp .env.example .env
nano .env
```

Configurez les valeurs récupérées précédemment :

```env
DISCORD_CLIENT_ID=123456789012345678
DISCORD_CLIENT_SECRET=AbCdEfGhIjKlMnOpQrStUvWxYz
DISCORD_TOKEN=MTIzNDU2Nzg5MDEyMzQ1Njc4.GhIjKl.AbCdEfGhIjKlMnOpQrStUvWxYz
DISCORD_OWNER_ID=876543210987654321
DISCORD_PUBLIC_KEY=abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwx
```

> **DISCORD_OWNER_ID** : votre ID Discord personnel (mode développeur Discord > clic droit sur votre nom > Copier l'ID).

---

## 5. Configurer OAuth2 pour le dashboard

### 5.1 Définir les URLs de redirection

Depuis le portail développeur, sous **OAuth2 > General** :

- **Redirects** : cliquez sur **Add Redirect**
- Ajoutez : `https://votre-domaine.com/auth/callback`
- En développement : `http://localhost:3000/auth/callback`

### 5.2 Mettre à jour le .env

```env
NEXT_PUBLIC_DISCORD_CLIENT_ID=123456789012345678
NEXT_PUBLIC_DISCORD_REDIRECT_URI=https://votre-domaine.com/auth/callback
NEXT_PUBLIC_SITE_URL=https://votre-domaine.com
NEXT_PUBLIC_API_URL=https://votre-domaine.com/api
API_URL=https://votre-domaine.com/api
CORS_ORIGIN=https://votre-domaine.com
```

En développement :

```env
NEXT_PUBLIC_DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
API_URL=http://localhost:4000
CORS_ORIGIN=http://localhost:3000
```

---

## 6. Lancer les migrations Prisma

```bash
cd /opt/pinguinboat/current
pnpm db:generate    # Génère le client Prisma
pnpm db:migrate     # Applique les migrations à la base de données
pnpm db:seed        # (optionnel) Ajoute les données initiales (plans premium, etc.)
```

Vérifiez que les tables sont créées :

```bash
psql -U pinguin -d pinguinboat -c "\dt"
```

---

## 7. Démarrer les services

```bash
cd /opt/pinguinboat/current
pm2 start deploy/pm2.config.json
pm2 save
pm2 startup
```

### Vérifier que tout tourne

```bash
pm2 status
```

Sortie attendue :

```
┌─────┬──────────────┬──────────┬────────┬──────────┐
│ id  │ name         │ mode     │ status │ cpu      │
├─────┼──────────────┼──────────┼────────┼──────────┤
│ 0   │ pinguin-api  │ fork     │ online │ 0.1%     │
│ 1   │ pinguin-bot  │ fork     │ online │ 0.3%     │
│ 2   │ pinguin-web  │ cluster  │ online │ 0.2%     │
└─────┴──────────────┴──────────┴────────┴──────────┘
```

---

## 8. Vérifier que le bot est en ligne

### 8.1 Sur Discord

1. Ouvrez Discord
2. Regardez la liste des membres de votre serveur
3. Le bot doit apparaître avec un statut **en ligne** (pastille verte)
4. L'activité doit afficher : `🏔️ Pinguin BOAT | /help`

### 8.2 Via les logs

```bash
pm2 logs pinguin-bot --lines 10
```

Vous devez voir :

```
[Bot] Connecté à PostgreSQL
[Bot] Connecté à Discord
```

### 8.3 Via l'API

```bash
curl https://votre-domaine.com/api/health
```

---

## 9. Tester les premières commandes

Dans un salon textuel de votre serveur Discord, tapez :

### `/ping`

```diff
- Pong! 🏓
- Latence : 42ms
- Latence API : 38ms
```

### `/help`

Affiche la liste complète des modules et commandes disponibles.

### Tester d'autres commandes

| Commande         | Description                        |
|------------------|------------------------------------|
| `/balance`       | Affiche votre solde économique     |
| `/daily`         | Réclamez votre récompense quotidienne |
| `/rank`          | Affiche votre niveau et XP         |
| `/embed create`  | Créez un embed personnalisé        |
| `/ticket open`   | Ouvrez un ticket de support        |
| `/giveaway start`| Lancez un giveaway                 |

---

## 10. Configurer OAuth2 pour le dashboard

### 10.1 Fonctionnement

Le dashboard utilise Discord OAuth2 pour authentifier les utilisateurs. Le flux est le suivant :

1. L'utilisateur clique sur **Se connecter avec Discord**
2. Discord affiche une page de consentement
3. L'utilisateur autorise l'application
4. Discord redirige vers `NEXT_PUBLIC_DISCORD_REDIRECT_URI`
5. L'API échange le code contre un token d'accès
6. L'API récupère les informations de l'utilisateur
7. Une session est créée (cookie sécurisé)

### 10.2 URLs de redirection OAuth2

| Environnement | URL                                      |
|---------------|------------------------------------------|
| Production    | `https://votre-domaine.com/auth/callback`|
| Développement | `http://localhost:3000/auth/callback`    |

### 10.3 Scopes OAuth2

Le dashboard nécessite les scopes suivants :

- `identify` — pour récupérer l'identité de l'utilisateur
- `guilds` — pour lister les serveurs de l'utilisateur

---

## 11. Activer le système de mise à jour GitHub

Pour utiliser la fonction de déploiement automatique depuis le panel owner :

### 11.1 Configurer le dépôt Git

```bash
git remote add origin https://github.com/utilisateur/pinguin-boat.git
```

### 11.2 Variables .env requises

```env
GITHUB_REPO=utilisateur/pinguin-boat
GITHUB_BRANCH=main
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx  # (optionnel, requis si dépôt privé)
```

### 11.3 Webhook GitHub (optionnel)

Pour un déploiement automatique à chaque push :

1. Sur GitHub, allez dans **Settings > Webhooks > Add webhook**
2. Payload URL : `https://votre-domaine.com/api/webhooks/deploy`
3. Content type : `application/json`
4. Events : sélectionnez **Branch or tag creation** et **Pushes**
5. Secret : `DISCORD_PUBLIC_KEY` (pour la signature HMAC)

---

## 12. Vérification de santé des services

### Script de healthcheck

```bash
bash /opt/pinguinboat/current/scripts/healthcheck.sh
```

Sortie attendue :

```
🏥 Healthcheck Pinguin BOAT
✅ API: OK
✅ Web: OK
✅ Bot: OK (PID 12345)

✅ Tous les services sont opérationnels.
```

### Endpoint API

```bash
curl https://votre-domaine.com/api/health
```

### Vérification automatisée (cron)

```bash
crontab -e
```

Ajoutez :

```cron
*/5 * * * * /opt/pinguinboat/current/scripts/healthcheck.sh >> /var/log/pinguin-healthcheck.log 2>&1
```

---

## 13. Dépannage

| Problème                          | Solution                                                       |
|-----------------------------------|----------------------------------------------------------------|
| Bot ne se connecte pas            | Vérifiez `DISCORD_TOKEN` dans le `.env` et les logs PM2        |
| Commandes slash non disponibles   | Réinvitez le bot avec le scope `applications.commands`         |
| Erreur 401 sur OAuth2             | Vérifiez `DISCORD_CLIENT_ID` et `DISCORD_CLIENT_SECRET`        |
| Le dashboard ne s'affiche pas     | Vérifiez les URLs de redirection OAuth2 dans le portail Discord|
| Migration Prisma échoue           | Vérifiez `DATABASE_URL` et que PostgreSQL est en ligne         |

---

> **Prochaine étape** : Consultez `OWNER_PANEL_FR.md` pour prendre en main le panel d'administration.
