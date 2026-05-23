
```
  ╔═══════════════════════════════════════════════╗
  ║               PINGUIN BOAT                    ║
  ║         Forgé pour la communauté              ║
  ╚═══════════════════════════════════════════════╝
```

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0--alpha-blueviolet?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-yellow?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/monorepo-pnpm-F69220?style=for-the-badge&logo=pnpm" alt="pnpm">
</p>

<p align="center">
  <strong>🐧 Pinguin BOAT</strong> — Bot Discord multifonction nouvelle génération.<br>
  Modération, musique, économie, niveaux, giveaways, tickets, sondages, suggestions, embeds, logs, welcome, autorôles, protection anti-raid… et un dashboard complet.
</p>

---

## ✨ Fonctionnalités

| Module         | Description                                        |
|----------------|----------------------------------------------------|
| 🛡️ Modération  | Ban, kick, mute, warn, purge, slowmode, lock, nuke |
| 🎵 Musique     | YouTube, Spotify, SoundCloud, files d'attente      |
| 💰 Économie    | Balance, daily, shop, transfert, banque            |
| 📊 Niveaux     | XP, classement, récompenses de rôle                |
| 🎫 Tickets     | Système de tickets avec catégories                 |
| 🎁 Giveaways   | Giveaways avec conditions                          |
| 📋 Sondages    | Sondages personnalisés                             |
| 💡 Suggestions | Système de suggestions avec vote                   |
| 👋 Welcome     | Messages de bienvenue / départ                     |
| 🤖 Autorôles   | Rôles automatiques à l'arrivée                     |
| 📝 Embeds      | Création d'embeds personnalisés                    |
| 🔒 Protection  | Anti-raid, anti-spam, anti-link, anti-mass-mention |
| 📜 Logs        | Journalisation complète des événements             |

---

## 🚀 Quick start

### Prérequis

- Debian 12, Node.js ≥ 20, pnpm ≥ 9, PostgreSQL 15+

### Installation en 5 minutes

```bash
# 1. Exécuter le script d'installation
bash scripts/install.sh

# 2. Cloner et configurer
git clone https://github.com/utilisateur/pinguin-boat.git /opt/pinguinboat/releases/initial
cp .env.example .env && nano .env   # Remplir les variables

# 3. Lier et builder
ln -sfn /opt/pinguinboat/releases/initial /opt/pinguinboat/current
cd /opt/pinguinboat/current
pnpm install && pnpm build && pnpm db:migrate

# 4. Démarrer
pm2 start deploy/pm2.config.json
pm2 save && pm2 startup
```

> Documentation complète : [INSTALLATION_FR.md](docs/INSTALLATION_FR.md)

---

## 🏗️ Architecture

```
pinguin-boat/
├── apps/
│   ├── web/          Dashboard Next.js
│   ├── api/          API Fastify
│   └── bot/          Bot Discord.js
├── packages/
│   ├── shared/       Types et énumérations partagés
│   ├── config/       Validation Zod des variables d'env
│   ├── db/           Client Prisma ORM
│   └── ui/           Design system (thèmes, hooks)
├── scripts/          Scripts shell (install, deploy, rollback…)
├── deploy/           Configurations Nginx, PM2
└── docs/             Documentation en français
```

> Structure détaillée : [STRUCTURE_PROJET_FR.md](docs/STRUCTURE_PROJET_FR.md)

---

## 📚 Documentation

| Document                                            | Description                              |
|-----------------------------------------------------|------------------------------------------|
| [Installation](docs/INSTALLATION_FR.md)             | Guide complet d'installation             |
| [Activation du bot](docs/ACTIVATION_BOT_FR.md)      | Configurer l'application Discord         |
| [Mise à jour](docs/MISE_A_JOUR_FR.md)               | Mettre à jour l'instance                 |
| [Rollback](docs/ROLLBACK_FR.md)                     | Revenir à une version précédente         |
| [Panel owner](docs/OWNER_PANEL_FR.md)               | Guide d'administration                   |
| [Thèmes](docs/THEMES_FR.md)                         | Personnalisation du dashboard            |
| [Architecture Premium](docs/PREMIUM_ARCHITECTURE_FR.md) | Système freemium                      |
| [Structure du projet](docs/STRUCTURE_PROJET_FR.md)  | Architecture du code                     |
| [Checklist production](docs/CHECKLIST_PRODUCTION_FR.md) | Vérification avant mise en prod      |

---

## 🛠️ Scripts disponibles

```bash
pnpm dev           # Lancer tout en mode développement (turbo)
pnpm build         # Builder tout le monorepo
pnpm lint          # Linter
pnpm typecheck     # Vérification TypeScript
pnpm db:generate   # Générer le client Prisma
pnpm db:migrate    # Appliquer les migrations
pnpm db:seed       # Peupler les données initiales
pnpm clean         # Nettoyer les artefacts de build
```

---

## 📄 License

MIT — voir le fichier [LICENSE](LICENSE).

---

<p align="center">
  <strong>Pinguin BOAT</strong> — Forgé pour la communauté 🐧👑
</p>
