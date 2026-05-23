# Guide de rollback de Pinguin BOAT

> Procédures de retour à une version précédente en cas de problème après une mise à jour.

---

## 1. Rollback automatique

Le déploiement automatique depuis le panel owner inclut une vérification de santé. Si celle-ci échoue, le déploiement est marqué comme **FAILED** mais le rollback n'est **pas automatique** : c'est à l'owner de décider de revenir en arrière.

### Comportement en cas d'échec

1. Le déploiement est cloné et buildé
2. Les migrations sont appliquées
3. Le swap de symlink est effectué
4. La vérification de santé est tentée (jusqu'à 10 fois, toutes les 2 secondes)
5. Si la vérification échoue :
   - Le déploiement est marqué `FAILED`
   - La nouvelle release est supprimée du disque
   - **L'ancienne release reste active** — aucun rollback manuel nécessaire

Ce mécanisme protège contre les déploiements défectueux : le service ne sera jamais indisponible à cause d'une mise à jour échouée.

---

## 2. Rollback manuel depuis le panel owner

### Procédure

1. Connectez-vous au dashboard : `https://votre-domaine.com`
2. Accédez au **Panel Owner** (2FA requis)
3. Dans le menu de gauche, cliquez sur **Déploiement**
4. La page affiche l'historique des déploiements avec leur statut
5. Repérez la version vers laquelle vous voulez revenir
6. Cliquez sur le bouton **Rollback** à côté de cette version
7. Confirmez l'action

### Résultat attendu

- Un nouveau déploiement de type `ROLLBACK` est créé
- Le lien symbolique `current` pointe maintenant vers l'ancienne release
- Les services PM2 sont redémarrés automatiquement
- La page se rafraîchit et affiche la nouvelle version active

---

## 3. Rollback manuel via le script rollback.sh

### Procédure

```bash
# En tant que root ou utilisateur pinguin
sudo bash /opt/pinguinboat/current/scripts/rollback.sh
```

### Sortie attendue

```
⏪ Rollback Pinguin BOAT
📂 Current: /opt/pinguinboat/releases/v1714512345678
📂 Rollback vers: /opt/pinguinboat/releases/v1714512000000
🔄 Redémarrage des services...
✅ Rollback terminé vers /opt/pinguinboat/releases/v1714512000000
```

### Fonctionnement du script

1. Il lit le lien symbolique `current` pour connaître la release active
2. Il liste toutes les releases dans `releases/`
3. Il sélectionne la deuxième plus récente (la release précédente)
4. Il met à jour le lien symbolique vers cette release
5. Il redémarre les trois services PM2

### Si vous voulez revenir à une version spécifique

```bash
# Lister les releases disponibles
ls -la /opt/pinguinboat/releases/

# Basculer manuellement vers une release spécifique
ln -sfn /opt/pinguinboat/releases/v1714512000000 /opt/pinguinboat/current
pm2 restart all --update-env
```

---

## 4. Rollback manuel via SSH

### 4.1 Lister les releases disponibles

```bash
ls -la /opt/pinguinboat/releases/
```

Exemple de sortie :

```
drwxr-xr-x 10 pinguin pinguin 4096 Jan  1 12:00 v1714512000000
drwxr-xr-x 10 pinguin pinguin 4096 Jan  1 13:00 v1714512345678
drwxr-xr-x 10 pinguin pinguin 4096 Jan  1 14:00 v1714513000000  ← version actuelle (défectueuse)
```

### 4.2 Voir la version actuelle

```bash
readlink -f /opt/pinguinboat/current
```

### 4.3 Effectuer le rollback

```bash
# Option 1 : Revenir à la version précédente immédiatement avant
RELEASE=$(ls -1 /opt/pinguinboat/releases/ | sort | tail -2 | head -1)
ln -sfn /opt/pinguinboat/releases/$RELEASE /opt/pinguinboat/current
pm2 restart all --update-env
```

```bash
# Option 2 : Revenir à une version spécifique
ln -sfn /opt/pinguinboat/releases/v1714512000000 /opt/pinguinboat/current
pm2 restart all --update-env
```

### 4.4 Vérification post-rollback

```bash
# Vérifier le lien symbolique
readlink -f /opt/pinguinboat/current
# Doit pointer vers la release précédente

# Vérifier les services
pm2 status
curl http://localhost:4000/api/health
```

---

## 5. Vérification post-rollback

### 5.1 Vérifier la version

```bash
cat /opt/pinguinboat/current/package.json | grep version
pm2 logs pinguin-api --lines 5 | grep "version"
```

### 5.2 Vérifier les services

```bash
# Healthcheck global
bash /opt/pinguinboat/current/scripts/healthcheck.sh

# Vérification individuelle
curl -f http://localhost:4000/api/health && echo "API OK" || echo "API DOWN"
curl -f http://localhost:3000 && echo "WEB OK" || echo "WEB DOWN"
pm2 pid pinguin-bot > /dev/null && echo "BOT OK" || echo "BOT DOWN"
```

### 5.3 Vérifier les données

```bash
# Vérifier que la base de données est accessible
psql -U pinguin -d pinguinboat -c "SELECT count(*) FROM guild;"

# Vérifier que les logs sont intacts
ls -la /opt/pinguinboat/shared/logs/
```

### 5.4 Vérifier le dashboard

1. Accédez à `https://votre-domaine.com`
2. Connectez-vous avec Discord
3. Vérifiez que les données s'affichent correctement
4. Testez une commande du bot sur Discord : `/ping`

---

## 6. Résolution des problèmes courants

### Le rollback échoue avec « Aucune release précédente trouvée »

**Cause** : Il n'y a qu'une seule release dans `releases/`.

**Solution** : Vous devez recloner le dépôt :

```bash
git clone https://github.com/utilisateur/pinguin-boat.git /opt/pinguinboat/releases/restore
ln -sfn /opt/pinguinboat/releases/restore /opt/pinguinboat/current
cd /opt/pinguinboat/current
pnpm install && pnpm build && pnpm db:migrate
pm2 restart all --update-env
```

### Une migration Prisma a modifié la base et le rollback du code ne suffit pas

Si la migration a modifié le schéma de la base de données, un rollback de code peut causer des incohérences.

**Solution** :

```bash
# 1. Revenir à l'ancienne version du code
ln -sfn /opt/pinguinboat/releases/v1714512000000 /opt/pinguinboat/current

# 2. Revenir à l'ancien schéma de base
cd /opt/pinguinboat/current
npx prisma migrate resolve --rolled-back "nom_de_la_migration_problematique"

# 3. Redémarrer
pm2 restart all --update-env
```

### Les services ne redémarrent pas après le rollback

```bash
# Arrêter et redémarrer manuellement
pm2 stop pinguin-api pinguin-bot pinguin-web
pm2 delete pinguin-api pinguin-bot pinguin-web
pm2 start /opt/pinguinboat/current/deploy/pm2.config.json

# Vérifier les logs
pm2 logs --lines 50
```

### Le bot est déconnecté après le rollback

```bash
# Vérifier le token
grep DISCORD_TOKEN /opt/pinguinboat/current/.env

# Redémarrer le bot uniquement
pm2 restart pinguin-bot --update-env
pm2 logs pinguin-bot --lines 20
```

### Le dashboard est cassé après le rollback

Si le dashboard Next.js ne s'affiche pas correctement :

```bash
# Vider le cache de build
rm -rf /opt/pinguinboat/current/apps/web/.next

# Rebuild
cd /opt/pinguinboat/current
pnpm build

# Redémarrer
pm2 restart pinguin-web --update-env
```

---

## 7. Sauvegarde de la base de données avant rollback

Il est recommandé de faire une sauvegarde avant d'effectuer un rollback :

```bash
bash /opt/pinguinboat/current/scripts/backup.sh
```

La sauvegarde est stockée dans `/opt/pinguinboat/backups/` avec le format :

```
pinguinboat-backup-20250101-120000.sql.gz
```

Les backups de plus de 30 jours sont automatiquement supprimés.

---

> **Prochaine étape** : Consultez `OWNER_PANEL_FR.md` pour maîtriser le panel d'administration complet.
