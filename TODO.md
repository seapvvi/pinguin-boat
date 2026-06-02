# TODO

- [ ] Mettre en place Vitest dans le workspace Turborepo
  - [ ] Ajouter vitest + dépendances de dev dans `packages/shared` et `apps/bot`
  - [ ] Ajouter `vitest.config.ts`
  - [ ] Ajouter task `test` dans `turbo.json`
- [ ] Créer tests unitaires (Vitest)
  - [ ] `calculateLevel` / calcul XP pour level up
  - [ ] `parseDuration` (tous les formats + erreurs)
  - [ ] Calcul d’intérêts bancaires (fonction pure)
  - [ ] Logique de cooldown (daily, work) (fonction pure + timers mock)
- [ ] Ajouter script `test` dans `packages/shared/package.json` et `apps/bot/package.json`
- [ ] Exécuter `pnpm test` (ou `pnpm --filter ... test`) + corriger les éventuels échecs

