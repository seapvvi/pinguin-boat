# Pinguin BOAT

[![CI](https://github.com/seapvvi/pinguin-boat/actions/workflows/ci.yml/badge.svg)](https://github.com/seapvvi/pinguin-boat/actions/workflows/ci.yml)

Bot Discord officiel de Pinguin Empire, avec dashboard web et API. Site : [pinguin.ovh](https://pinguin.ovh)

> Projet en alpha (`0.1.0-alpha`).

## Structure

- `apps/` : bot, API, web (Next.js)
- `packages/` : config, db (Prisma), shared, ui
- `deploy/`, `scripts/` : déploiement
- `docs/` : documentation détaillée

## Installation rapide

```bash
pnpm install
cp .env.example .env   # puis remplir les valeurs
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Prérequis : Node >= 20, pnpm >= 9, PostgreSQL.

## Scripts utiles

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format:check`.

## Musique

Le support YouTube via yt-dlp et cookie est fragile et peut enfreindre les conditions d'utilisation de YouTube. Il est fourni sans garantie ; préférez des sources autorisées.

## Contribuer et sécurité

Voir [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) et [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
