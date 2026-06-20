# TODO - Optimisations perf (sans casser graphismes/animations)

## Étape 1 (fait / en cours)
- [x] apps/web/app/page.tsx : supprimer re-renders liés au parallax souris (mousemove)
- [ ] apps/web/app/page.tsx : optimisation AnimatedCounter (moins de state updates)
- [ ] apps/web/app/page.tsx : lazy loading de `TerminalDemo` (et/ou réduction du coût initial)
- [ ] apps/api : caching stats/changelogs landing (Cache-Control / ETag)




## Étape 2
- [ ] Build + typecheck
- [ ] Vérifier que reduced motion fonctionne (animations coupées/atténuées)

## Étape 3
- [ ] (Plus tard) caching API pour endpoints landing (stats/changelogs)

