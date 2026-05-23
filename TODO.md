# TODO - Dashboard Discord (proxy API)

- [ ] Comprendre pourquoi le dashboard (Next) proxy vers `http://localhost:4000` alors que l’API est sur `192.168.1.130`
- [ ] Modifier `apps/web/next.config.js` pour utiliser une URL d’API configurable (ex: `NEXT_PUBLIC_API_URL` ou `API_URL`) au lieu de `localhost:4000`
- [ ] Optionnel: ajouter `allowedDevOrigins` pour supprimer le warning cross-origin Next.js
- [ ] Vérifier que `apps/api` est accessible depuis la machine du navigateur sur `192.168.1.130:<port>/api/auth/me`
- [ ] Lancer/rétester : dashboard + appel `/api/auth/me` puis login Discord

