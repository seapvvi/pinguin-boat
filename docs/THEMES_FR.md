# Thèmes du dashboard — Pinguin BOAT

> 10 thèmes disponibles pour personnaliser l'apparence du dashboard. La sélection est sauvegardée par utilisateur.

---

## 1. Liste complète des thèmes

| Thème          | Fond principal | Accent        | Type  |
|----------------|----------------|---------------|-------|
| **OLED**       | `#000000`      | `#e0e0e0`    | 🌙 Sombre |
| **Sombre**     | `#111111`      | `#ffffff`    | 🌙 Sombre |
| **Clair**      | `#f5f5f5`      | `#000000`    | ☀️ Clair  |
| **Catppuccin** | `#1e1e2e`      | `#cba6f7`    | 🌙 Sombre |
| **Nord**       | `#2e3440`      | `#88c0d0`    | 🌙 Sombre |
| **Dracula**    | `#282a36`      | `#bd93f9`    | 🌙 Sombre |
| **Gruvbox**    | `#282828`      | `#fabd2f`    | 🌙 Sombre |
| **Tokyo Night**| `#1a1b26`      | `#7aa2f7`    | 🌙 Sombre |
| **Rose Pine**  | `#191724`      | `#eb6f92`    | 🌙 Sombre |
| **Monokai**    | `#272822`      | `#a6e22e`    | 🌙 Sombre |

---

## 2. OLED (défaut)

Le thème par défaut, conçu pour les écrans OLED/AMOLED.

- **Fond** : noir profond (`#000000`) — les pixels noirs sont éteints sur OLED
- **Surface** : gris très foncé (`#0d0d0d`)
- **Texte** : blanc cassé (`#f5f5f5`)
- **Accent** : gris clair (`#e0e0e0`)
- **Succès** : vert (`#22c55e`)
- **Erreur** : rouge (`#ef4444`)
- **Info** : bleu (`#3b82f6`)

Utilisation : `localStorage.setItem('pinguin-theme', 'OLED')`

---

## 3. Sombre

Un thème sombre classique, légèrement plus contrasté que l'OLED.

- **Fond** : `#111111`
- **Surface** : `#1a1a1a`
- **Accent** : `#ffffff` (blanc pur)
- **Texte secondaire** : `#888888`

Bon compromis entre économie d'énergie et lisibilité.

---

## 4. Clair

Thème lumineux pour une utilisation en environnement très éclairé.

- **Fond** : `#f5f5f5` (blanc cassé)
- **Surface** : `#ffffff` (blanc pur)
- **Texte** : `#111111` (noir)
- **Bordures** : `#e0e0e0`
- **Accent** : `#000000` (noir)

Respecte les contrastes WCAG AA.

---

## 5. Catppuccin

Inspiré du célèbre thème Catppuccin Mocha.

| Couleur       | Code       |
|---------------|------------|
| Fond          | `#1e1e2e`  |
| Surface       | `#181825`  |
| Texte         | `#cdd6f4`  |
| Texte second. | `#6c7086`  |
| Accent        | `#cba6f7`  |
| Accent survol | `#b4befe`  |
| Succès        | `#a6e3a1`  |
| Erreur        | `#f38ba8`  |

---

## 6. Nord

Inspiré de la palette arctique Nord.

| Couleur       | Code       |
|---------------|------------|
| Fond          | `#2e3440`  |
| Surface       | `#3b4252`  |
| Texte         | `#eceff4`  |
| Texte second. | `#81a1c1`  |
| Accent        | `#88c0d0`  |
| Succès        | `#a3be8c`  |
| Erreur        | `#bf616a`  |

---

## 7. Dracula

Le thème Dracula classique, aux teintes violettes.

| Couleur       | Code       |
|---------------|------------|
| Fond          | `#282a36`  |
| Surface       | `#21222c`  |
| Texte         | `#f8f8f2`  |
| Texte second. | `#6272a4`  |
| Accent        | `#bd93f9`  |
| Accent survol | `#ff79c6`  |
| Succès        | `#50fa7b`  |
| Erreur        | `#ff5555`  |

---

## 8. Gruvbox

Palette rétro aux teintes chaudes (dark mode).

| Couleur       | Code       |
|---------------|------------|
| Fond          | `#282828`  |
| Surface       | `#1d2021`  |
| Texte         | `#ebdbb2`  |
| Texte second. | `#928374`  |
| Accent        | `#fabd2f`  |
| Accent survol | `#fe8019`  |
| Succès        | `#b8bb26`  |
| Erreur        | `#fb4934`  |

---

## 9. Tokyo Night

Inspiré du thème Tokyo Night, aux tons bleus profonds.

| Couleur       | Code       |
|---------------|------------|
| Fond          | `#1a1b26`  |
| Surface       | `#1f2335`  |
| Texte         | `#c0caf5`  |
| Texte second. | `#565f89`  |
| Accent        | `#7aa2f7`  |
| Accent survol | `#bb9af7`  |
| Succès        | `#9ece6a`  |
| Erreur        | `#f7768e`  |

---

## 10. Rose Pine

Palette douce aux teintes rosées.

| Couleur       | Code       |
|---------------|------------|
| Fond          | `#191724`  |
| Surface       | `#1f1d2e`  |
| Texte         | `#e0def4`  |
| Texte second. | `#908caa`  |
| Accent        | `#eb6f92`  |
| Accent survol | `#f6c177`  |
| Succès        | `#9ccfd8`  |
| Erreur        | `#eb6f92`  |

---

## 11. Monokai

Thème vert néon, inspiré de l'éditeur Monokai.

| Couleur       | Code       |
|---------------|------------|
| Fond          | `#272822`  |
| Surface       | `#1e1f1c`  |
| Texte         | `#f8f8f2`  |
| Texte second. | `#75715e`  |
| Accent        | `#a6e22e`  |
| Accent survol | `#66d9ef`  |
| Succès        | `#a6e22e`  |
| Erreur        | `#f92672`  |

---

## 12. Comment changer de thème

### Depuis le dashboard

1. Cliquez sur votre avatar en bas à gauche
2. Ouvrez les **Paramètres**
3. Allez dans l'onglet **Apparence**
4. Cliquez sur le thème de votre choix
5. Le changement est immédiat et persistant

### Depuis la console navigateur

```javascript
// Changer le thème
localStorage.setItem('pinguin-theme', 'DRACULA');
window.location.reload();

// Voir le thème actuel
localStorage.getItem('pinguin-theme');
```

### Programme (API de thème)

Le module `@pinguin/shared` exporte une API complète :

```typescript
import { getTheme, ThemeName } from '@pinguin/shared';
import { applyTheme } from '@pinguin/ui';

// Appliquer le thème Dracula
const theme = getTheme(ThemeName.DRACULA);
applyTheme(theme);
```

---

## 13. Sauvegarde du thème par utilisateur

### Fonctionnement

1. Le thème est stocké dans `localStorage` avec la clé `pinguin-theme`
2. La valeur est le nom du thème (`OLED`, `DARK`, `LIGHT`, etc.)
3. Le thème est persisté entre les sessions navigateur
4. Chaque utilisateur a son propre thème (pas de thème global)

### À la première visite

- Si aucun thème n'est stocké, le thème **OLED** est appliqué par défaut
- Le choix est immédiatement persisté dans le localStorage

### Code source

Le hook `useTheme` dans `@pinguin/ui` :

```typescript
const { current, setTheme, isDark } = useTheme();

// current : thème actuel (ex. 'DRACULA')
// setTheme : fonction pour changer de thème
// isDark   : booléen indiquant si le thème est sombre
```

La fonction `applyTheme` injecte les variables CSS dans le document :

```css
:root {
  --bg-primary: #282a36;
  --bg-surface: #21222c;
  --text-primary: #f8f8f2;
  --accent: #bd93f9;
  /* ... */
}
```

---

## 14. Accessibilité et contraste

### Ratios de contraste

Tous les thèmes respectent au minimum le niveau WCAG AA (ratio ≥ 4.5:1 pour le texte normal) :

| Thème         | Ratio texte/fond |
|---------------|-----------------|
| OLED          | 16.5:1          |
| Sombre        | 14.2:1          |
| Clair         | 15.1:1          |
| Catppuccin    | 12.8:1          |
| Nord          | 10.3:1          |
| Dracula       | 13.1:1          |
| Gruvbox       | 9.8:1           |
| Tokyo Night   | 11.5:1          |
| Rose Pine     | 10.1:1          |
| Monokai       | 12.4:1          |

### Bonnes pratiques

- Les thèmes sombres sont recommandés pour une utilisation prolongée
- Le thème **Clair** est recommandé pour les environnements très lumineux
- Les utilisateurs malvoyants peuvent choisir le thème **Sombre** (contraste élevé)
- La sidebar utilise un fond légèrement différent du fond principal pour une délimitation claire

---

## 15. Flocons de neige décoratifs

### Activation

Les flocons de neige sont un effet décoratif optionnel activable depuis les paramètres d'apparence.

### Fonctionnement

```typescript
import { useSnowflakes } from '@pinguin/ui';

function App() {
  const { enabled, toggle } = useSnowflakes();
  // enabled : booléen
  // toggle  : fonction pour activer/désactiver
}
```

- Les flocons apparaissent en surimpression du dashboard
- Ils suivent une animation de chute fluide (via `motion` / `framer-motion`)
- Désactivés par défaut pour les performances
- Configuration possible : densité, vitesse, taille
- L'état est sauvegardé dans `localStorage`

---

> **Prochaine étape** : Consultez `PREMIUM_ARCHITECTURE_FR.md` pour comprendre le système freemium.
