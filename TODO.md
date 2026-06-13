# TODO - pinguin-boat UI dashboard perf

- [ ] Ajouter SkeletonPage + early return sur toutes les pages dashboard `apps/web/app/(dashboard)/servers/[guildId]/*/page.tsx` (rows 1/2/3 selon complexité) [en cours: overview, automod]
- [ ] Créer hook `apps/web/hooks/useCountUp.ts`
- [ ] Mettre à jour `packages/ui/src/components/KPICard.tsx` pour animer les KPIs numériques
- [x] Appliquer SkeletonPage sur la page overview (early return) + réparation du fichier
- [x] Appliquer SkeletonPage sur la page automod (early return)
- [ ] Mettre à jour `packages/ui/src/components/Table.tsx` pour cascade avec `motion/react` et variants `itemVariants/containerVariants`
- [ ] Rechercher/mettre en place configuration du toaster (Sonner) ou wrapper motion pour notifications
- [ ] Implémenter badge « ON » sur les modules récemment activés via `SectionCard` + propagation de l’info depuis les toggles

- [ ] Corriger TS strict (zéro any)
- [ ] `pnpm typecheck`
- [ ] Vérifier : overview count-up, tableau cascade, skeleton affiché pendant fetch, reduced-motion OK

