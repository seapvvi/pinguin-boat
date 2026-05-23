# TODO

- [ ] Corriger la page dashboard Welcome pour qu’elle utilise uniquement les champs définis dans `WelcomeSettings` (packages/shared/src/types.ts)
- [ ] Enlever les champs frontend inexistants (ex: welcomeEmbedUrl, goodbyeEmbedUrl, goodbyeImageUrl, dmWelcomeMessage) et s’assurer que l’API reçoit `welcome/welcomeMessage/...` correctement
- [ ] Retirer l’UI de couleur d’embed si elle n’est pas stockée (ou la connecter à un champ réel)
- [ ] Vérifier que le clic “Enregistrer” déclenche bien `updateGuildSettings` avec le bon payload

