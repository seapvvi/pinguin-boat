# TODO

- [ ] Créer la commande Discord owner-only **/status** dans `apps/bot/src/commands/utility/status.ts`
  - [ ] Récupérer le dernier `SystemMetricsSnapshot`
  - [ ] Calculer/formatter : uptime, nb guilds, nb utilisateurs, latence API Discord, CPU/RAM
  - [ ] Ajouter version depuis `apps/bot/package.json`
  - [ ] Répondre en embed en français, ephemeral en erreur
  - [ ] (Fallback) Si aucun snapshot, utiliser `process.uptime()` + caches discord.js

- [ ] Tester la commande manuellement côté bot
  - [ ] Owner : vérifier l’affichage de tous les champs
  - [ ] Non-owner : vérifier le refus

- [ ] Lancer un typecheck
  - [ ] `pnpm -C apps/bot typecheck`

