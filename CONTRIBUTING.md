# Contribuer à Pinguin BOAT

1. Forkez le dépôt et créez une branche depuis `master` (`feat/...`, `fix/...`).
2. Installez : `pnpm install`, puis copiez `.env.example` vers `.env`.
3. Lancez `pnpm dev`.
4. Avant de pousser : `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`.
5. Ouvrez une PR vers `master` avec le template. La CI doit être verte.

Ne commitez jamais de `.env`, de token ou de secret.
