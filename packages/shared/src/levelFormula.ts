/**
 * Convention : XP totale (cumulative) depuis le début.
 *
 * - `calculateXpForLevel(N)`   → XP totale nécessaire pour atteindre le niveau N
 * - `calculateLevel(XP)`       → niveau atteint avec une XP totale donnée (inverse du dessus)
 * - `calculateXpForNextLevel`  → XP totale nécessaire pour atteindre le niveau suivant
 * - `getXpForCurrentLevel`     → XP totale nécessaire pour le niveau actuel
 * - `getXpRemainingToNextLevel`→ XP restante avant le prochain niveau
 *
 * Formule par défaut : `floor(100 * level * 1.5)` soit `floor(150 * level)`.
 * Chaque niveau coûte 150 XP à franchir.
 */

export const DEFAULT_LEVEL_FORMULA = '100 * level * 1.5';
const XP_PER_LEVEL = 150;

/** Évalue une formule personnalisée (ex: "100 * level * 1.5") pour un niveau donné. */
function evalFormula(formula: string, level: number): number | null {
  try {
    const result = new Function('level', `return ${formula}`)(level);
    return Number.isFinite(result) && result > 0 ? Math.floor(result) : null;
  } catch {
    return null;
  }
}

/**
 * Retourne le niveau correspondant à une XP totale cumulative.
 * Utilise la formule par défaut (les formules personnalisées ne concernent que l'affichage).
 */
export function calculateLevel(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) {
    return 0;
  }
  return Math.floor(xp / XP_PER_LEVEL);
}

/**
 * Retourne l'XP totale (cumulative) nécessaire pour atteindre un niveau donné.
 * Exemple : `calculateXpForLevel(5)` = XP totale pour être niveau 5.
 */
export function calculateXpForLevel(level: number): number {
  if (!Number.isFinite(level) || level < 0) {
    return 0;
  }
  const xp = Math.floor(level) * XP_PER_LEVEL;
  if (!Number.isFinite(xp)) return 0;
  return xp;
}

/**
 * Retourne l'XP totale (cumulative) nécessaire pour atteindre le niveau suivant.
 *
 * @param currentXp XP totale actuelle
 * @param formula   Formule personnalisée (optionnelle). Si absente, utilise la formule par défaut.
 */
export function calculateXpForNextLevel(currentXp: number, formula?: string): number {
  const currentLevel = calculateLevel(currentXp);
  const targetLevel = currentLevel + 1;
  if (formula) {
    const result = evalFormula(formula, targetLevel);
    if (result !== null) return result;
  }
  return calculateXpForLevel(targetLevel);
}

/**
 * Retourne l'XP totale (cumulative) nécessaire pour le niveau actuel.
 * Équivalent à `calculateXpForLevel(calculateLevel(xp))`.
 */
export function getXpForCurrentLevel(xp: number): number {
  return calculateXpForLevel(calculateLevel(xp));
}

/**
 * Retourne l'XP restante avant d'atteindre le prochain niveau.
 *
 * @param currentXp XP totale actuelle
 * @param formula   Formule personnalisée (optionnelle)
 */
export function getXpRemainingToNextLevel(currentXp: number, formula?: string): number {
  const nextThreshold = calculateXpForNextLevel(currentXp, formula);
  const diff = nextThreshold - currentXp;
  return diff > 0 ? diff : 0;
}
