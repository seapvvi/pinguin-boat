# TODO

- [x] (1) Ajouter un fallback/guard dans `apps/web/app/(dashboard)/servers/[guildId]/welcome/page.tsx` pour éviter le crash quand `res.data.guild.welcome` est `undefined`.
- [ ] (2) Sécuriser les accès à `local.*` dans la page (default values) pour que le rendu fonctionne même si certaines propriétés sont manquantes.
- [ ] (3) (Après validation) Chercher côté backend la route/DTO `GET /api/guilds/:guildId` et vérifier pourquoi `welcome` n’est pas renvoyé (ou renvoyé partiellement).
- [ ] (4) Lancer tests/Next dev et vérifier que la page “Bienvenue / Au revoir” ne plante plus.

