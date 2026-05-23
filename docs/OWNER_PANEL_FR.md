# Guide du panel owner — Pinguin BOAT

> Documentation complète du panneau d'administration réservé au propriétaire du bot.

---

## 1. Accès au panel owner

### 1.1 Conditions d'accès

- Être connecté avec le compte Discord défini dans `DISCORD_OWNER_ID`
- Avoir configuré et validé le 2FA (obligatoire)
- Avoir une session active sur le dashboard

### 1.2 Connexion

1. Accédez à `https://votre-domaine.com`
2. Authentifiez-vous via Discord OAuth2
3. Cliquez sur votre avatar en bas à gauche de l'écran
4. Cliquez sur **Panel Owner** (uniquement visible si vous êtes l'owner)

### 1.3 Sécurité

- L'accès au panel owner est **strictement limité** à l'utilisateur défini dans `DISCORD_OWNER_ID`
- Toutes les actions sont journalisées dans la table `OwnerLog`
- Une tentative d'accès non autorisé est enregistrée et peut être alertée

---

## 2. Configuration 2FA obligatoire

La première connexion au panel owner vous demandera de configurer l'authentification à deux facteurs (2FA).

### 2.1 Configuration initiale

1. Cliquez sur **Configurer le 2FA**
2. Scannez le QR code avec Google Authenticator, Authy ou 1Password
3. Saisissez le code à 6 chiffres généré par l'application
4. Cliquez sur **Vérifier et activer**

### 2.2 Utilisation

- À chaque ouverture du panel, un code 2FA vous sera demandé
- La session 2FA est valide tant que la session dashboard est active
- En cas de perte de l'accès 2FA, une procédure de récupération manuelle via SSH est nécessaire

### 2.3 Désactiver le 2FA

1. Depuis le panel owner, allez dans **Sécurité**
2. Cliquez sur **Désactiver le 2FA**
3. Saisissez un code 2FA valide
4. Confirmez la désactivation

> Il est **fortement déconseillé** de désactiver le 2FA sur une instance en production.

---

## 3. Dashboard owner : vue d'ensemble

### 3.1 Barre latérale

| Menu                 | Description                                     |
|----------------------|-------------------------------------------------|
| **Vue d'ensemble**   | Statistiques globales et métriques système      |
| **Serveurs**         | Liste des serveurs où le bot est présent        |
| **Utilisateurs**     | Base d'utilisateurs du bot                      |
| **Blacklists**       | Gestion des blacklists utilisateurs et serveurs |
| **Déploiement**      | Déploiement et rollback depuis GitHub           |
| **Changelogs**       | Publication des notes de version                |
| **Premium**          | Gestion des abonnements et feature flags        |
| **Annonces**         | Envoi d'annonces globales aux serveurs          |
| **Services**         | Statut et redémarrage des services              |
| **Logs d'actions**   | Journal complet des actions owner               |
| **Sécurité**         | Configuration 2FA                               |

### 3.2 Statistiques globales

La vue d'ensemble affiche :

- **Serveurs** : nombre total de serveurs avec le bot
- **Utilisateurs** : nombre d'utilisateurs en base
- **XP total** : somme de l'XP de tous les utilisateurs
- **Cas de modération** : nombre total de sanctions
- **Abonnements premium** : nombre d'abonnements actifs
- **CPU** : utilisation CPU du serveur
- **RAM** : utilisation mémoire
- **Uptime** : temps depuis le dernier démarrage

---

## 4. Gestion des serveurs

### 4.1 Liste des serveurs

La page affiche tous les serveurs où le bot est présent :

- Nom du serveur (avec icône)
- ID Discord du serveur
- Nombre de membres
- Propriétaire
- Date d'ajout
- Statut premium
- Nombre de cas de modération
- Nombre de tickets ouverts

### 4.2 Forcer le départ du bot

1. Repérez le serveur dans la liste
2. Cliquez sur l'icône **Quitter** (ou le bouton **Force Leave**)
3. Confirmez l'action
4. Le bot envoie une requête DELETE à l'API Discord pour quitter le serveur
5. La base de données est mise à jour (`botPresent = false`)

> Utilisé pour retirer le bot d'un serveur où il cause des problèmes, ou en cas d'abus.

### 4.3 Blacklister un serveur

Voir section 6.

---

## 5. Gestion des utilisateurs

### 5.1 Liste des utilisateurs

- ID Discord
- Nom d'utilisateur
- Avatar
- Date de première connexion
- Nombre de sessions
- Statut premium

### 5.2 Blacklister un utilisateur

1. Recherchez l'utilisateur par ID ou nom
2. Cliquez sur **Blacklister**
3. Saisissez la raison
4. Confirmez
5. L'utilisateur est blacklisté : ses sessions sont supprimées et le bot ignore ses interactions

### 5.3 Accorder le statut premium

Voir section 8.

---

## 6. Gestion des blacklists

### 6.1 Blacklist utilisateurs

**Ajouter** :

```
POST /api/owner/blacklist/users
Body : { "targetId": "123456789", "reason": "Abus du système" }
```

**Supprimer** :

```
DELETE /api/owner/blacklist/users/123456789
```

**Fonctionnement** : Un utilisateur blacklisté ne peut plus utiliser le dashboard. Toutes ses sessions sont immédiatement révoquées. Le bot ignore ses commandes.

### 6.2 Blacklist serveurs

**Ajouter** :

```
POST /api/owner/blacklist/guilds
Body : { "targetId": "987654321", "reason": "Spam" }
```

**Supprimer** :

```
DELETE /api/owner/blacklist/guilds/987654321
```

**Fonctionnement** : Un serveur blacklisté voit le bot quitter le serveur immédiatement. Le bot refuse toute nouvelle invitation de ce serveur.

---

## 7. Déploiement

### 7.1 Déploiement depuis GitHub

1. Allez dans **Déploiement** > **Lancer un déploiement**
2. Le système :
   - Clone le dépôt depuis `GITHUB_REPO` sur la branche `GITHUB_BRANCH`
   - Crée les liens symboliques vers les fichiers partagés
   - Installe les dépendances
   - Build le projet
   - Applique les migrations Prisma
   - Swap le lien symbolique `current`
   - Redémarre les services
3. Les logs s'affichent en temps réel dans le panel

### 7.2 Statut du déploiement

| Statut          | Description                          |
|-----------------|--------------------------------------|
| `PENDING`       | En attente de démarrage              |
| `RUNNING`       | En cours                            |
| `SUCCESS`       | Terminé avec succès                  |
| `FAILED`        | Échoué (l'ancienne version est active)|
| `ROLLED_BACK`   | Un rollback a été effectué           |

### 7.3 Prérequis

- `GITHUB_REPO` configuré dans le `.env`
- `GITHUB_BRANCH` configurée (par défaut `main`)
- `GITHUB_TOKEN` si le dépôt est privé
- Le dépôt doit contenir une configuration de build fonctionnelle

---

## 8. Rollback

### 8.1 Depuis le panel

1. Allez dans **Déploiement** > **Rollback**
2. Sélectionnez la version cible dans la liste des releases disponibles
3. Cliquez sur **Effectuer le rollback**
4. Le lien symbolique est mis à jour vers la version sélectionnée
5. Les services sont redémarrés

### 8.2 Liste des releases disponibles

Le panel affiche toutes les releases dans `releases/` avec :

- Nom de la version
- Date de création
- Version actuelle (marquée)
- Bouton Rollback pour chaque version précédente

---

## 9. Changelogs

### 9.1 Créer un changelog

1. Allez dans **Changelogs**
2. Cliquez sur **Nouveau changelog**
3. Remplissez :
   - **Version** : ex. `1.0.0`
   - **Titre** : ex. « Ajout de la musique et correction de bugs »
   - **Contenu** : description détaillée des changements
4. Cliquez sur **Publier**
5. Le changelog est visible par tous les utilisateurs dans le dashboard

### 9.2 Gestion des changelogs

- **Modifier** : changement de titre, contenu ou statut de publication
- **Supprimer** : suppression définitive
- **Historique** : tous les changelogs publiés sont listés avec pagination

---

## 10. Métriques système

### 10.1 Métriques temps réel

La page **Vue d'ensemble** affiche en temps réel :

- **CPU** : pourcentage d'utilisation (tous cœurs)
- **RAM** : mémoire utilisée / totale (MB)
- **Uptime** : temps depuis le démarrage du serveur
- **Charge moyenne** : load average (1, 5, 15 minutes)
- **Processus** : uptime du processus PM2

### 10.2 Métriques stockées

Le système enregistre des snapshots périodiques dans `SystemMetricsSnapshot` :

- CPU, RAM, uptime
- Nombre de serveurs, utilisateurs
- Commandes exécutées
- Messages aujourd'hui
- Salons actifs

Ces données permettent d'afficher des graphiques d'évolution sur 24h, 7 jours et 30 jours.

---

## 11. Gestion Premium et Feature Flags

### 11.1 Feature Flags

Les feature flags permettent d'activer ou désactiver des fonctionnalités indépendamment des plans premium.

**Flags disponibles** (exemples) :

| Flag                    | Description                       |
|------------------------|-----------------------------------|
| `music`                | Module musique                    |
| `economy`              | Module économique                 |
| `levels`               | Module niveaux                    |
| `tickets`              | Module tickets                    |
| `giveaways`            | Module giveaways                  |
| `automod`              | Auto-modération avancée           |

### 11.2 Mode alpha

Le mode alpha (`ALPHA_ALL_FREE=true`) désactive toutes les restrictions premium :

- Toutes les fonctionnalités sont accessibles gratuitement
- Aucune limitation de serveurs
- Utile pour le développement et les tests
- Depuis le panel : bascule **Mode alpha tout gratuit**

### 11.3 Accorder le premium

1. Allez dans **Premium**
2. Sélectionnez **Utilisateur** ou **Serveur**
3. Saisissez l'ID Discord
4. Choisissez le plan : `BASIC`, `PRO` ou `ENTERPRISE`
5. Cliquez sur **Accorder**

### 11.4 Révoquer le premium

1. Allez dans **Premium**
2. Cliquez sur **Révoquer** à côté de l'entrée concernée
3. Confirmez

---

## 12. Annonces globales

### 12.1 Envoyer une annonce

1. Allez dans **Annonces**
2. Rédigez le message de l'annonce
3. (Optionnel) Ajoutez un embed personnalisé (titre, description, couleur)
4. Cliquez sur **Envoyer à tous les serveurs**

### 12.2 Fonctionnement

- Le système parcourt tous les serveurs où le bot est présent
- Il cherche un salon nommé `announcements` (ou le salon configuré)
- Le message est envoyé avec le contenu et l'embed spécifiés
- Un log est créé avec le nombre de serveurs touchés

---

## 13. Logs des actions owner

### 13.1 Traçabilité

Toutes les actions effectuées dans le panel owner sont enregistrées dans la base de données :

| Champ       | Description                 |
|-------------|-----------------------------|
| `userId`    | ID de l'owner               |
| `action`    | Type d'action               |
| `details`   | JSON contenant les détails  |
| `ip`        | Adresse IP de l'owner       |
| `userAgent` | Navigateur utilisé          |
| `createdAt` | Date et heure               |
| `success`   | Succès ou échec             |

### 13.2 Types d'actions

| Action                    | Description                         |
|---------------------------|-------------------------------------|
| `BLACKLIST_USER`          | Blacklist d'un utilisateur          |
| `UNBLACKLIST_USER`        | Retrait de blacklist utilisateur    |
| `BLACKLIST_GUILD`         | Blacklist d'un serveur              |
| `UNBLACKLIST_GUILD`       | Retrait de blacklist serveur        |
| `FORCE_LEAVE`             | Retrait forcé d'un serveur          |
| `DEPLOYMENT_START`        | Début de déploiement                |
| `DEPLOYMENT_SUCCESS`      | Déploiement réussi                  |
| `DEPLOYMENT_FAILURE`      | Échec de déploiement                |
| `DEPLOYMENT_ROLLBACK`     | Rollback effectué                   |
| `PREMIUM_GRANT`           | Premium accordé                     |
| `PREMIUM_REVOKE`          | Premium révoqué                     |
| `ALPHA_MODE_TOGGLE`       | Mode alpha activé/désactivé         |
| `CHANGELOG_PUBLISH`       | Publication d'un changelog          |
| `GLOBAL_ANNOUNCEMENT`     | Annonce globale envoyée             |
| `SERVICE_RESTART`         | Redémarrage d'un service            |
| `BACKUP_CREATED`          | Sauvegarde créée                    |
| `BACKUP_RESTORED`         | Sauvegarde restaurée                |
| `SETTINGS_CHANGE`         | Modification de paramètres          |
| `OWNER_LOGIN`             | Connexion au panel owner            |
| `OWNER_LOGOUT`            | Déconnexion du panel owner          |

### 13.3 Visualisation

Le journal est accessible depuis **Logs d'actions** dans le panel :

- Pagination (20 entrées par page)
- Filtre par type d'action
- Recherche par utilisateur
- Export possible

---

## 14. Gestion des services

### 14.1 Services disponibles

| Service       | Description                        | Port |
|---------------|------------------------------------|------|
| `pinguin-api` | API Fastify                        | 4000 |
| `pinguin-bot` | Bot Discord.js                     | —    |
| `pinguin-web` | Dashboard Next.js                  | 3000 |

### 14.2 Actions disponibles

- **Redémarrer** : arrêt puis démarrage du service
- **Forcer le redémarrage** : kill puis démarrage
- **Voir les logs** : affiche les 50 dernières lignes

### 14.3 Indicateurs de statut

- **🟢 Online** : service en cours d'exécution
- **🟡 Starting** : service en cours de démarrage
- **🔴 Stopped** : service arrêté
- **❌ Errored** : service en erreur (tentatives de redémarrage épuisées)

---

## 15. Journal complet des actions

### 15.1 Accès

Depuis le panneau **Logs d'actions**, vous pouvez :

- Parcourir l'historique complet (pagination)
- Filtrer par type d'action
- Rechercher par date
- Consulter les détails de chaque action (date, IP, user-agent, payload JSON)

### 15.2 Conservation

Les logs sont conservés indéfiniment en base de données. Il est recommandé de mettre en place une rotation si le volume devient trop important (via cron ou script externe).

---

> **Prochaine étape** : Consultez `THEMES_FR.md` pour personnaliser l'apparence du dashboard.
