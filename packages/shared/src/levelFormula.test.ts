import { describe, expect, it } from 'vitest';
import {
  calculateLevel,
  calculateXpForLevel,
  calculateXpForNextLevel,
  getXpForCurrentLevel,
  getXpRemainingToNextLevel,
  DEFAULT_LEVEL_FORMULA,
} from './levelFormula';

describe('calculateLevel', () => {
  it('retourne 0 pour xp < 150', () => {
    expect(calculateLevel(0)).toBe(0);
    expect(calculateLevel(1)).toBe(0);
    expect(calculateLevel(149)).toBe(0);
  });

  it('seuils exacts : 150 → niveau 1', () => {
    expect(calculateLevel(150)).toBe(1);
  });

  it('seuils exacts : 300 → niveau 2', () => {
    expect(calculateLevel(300)).toBe(2);
  });

  it('seuils exacts : 450 → niveau 3', () => {
    expect(calculateLevel(450)).toBe(3);
  });

  it('à l\'intérieur d\'un palier (entre 150 et 299) → niveau 1', () => {
    expect(calculateLevel(150)).toBe(1);
    expect(calculateLevel(200)).toBe(1);
    expect(calculateLevel(299)).toBe(1);
  });

  it('valeurs élevées', () => {
    // 10 000 XP → niveau 66 (66 * 150 = 9900, 67 * 150 = 10050)
    expect(calculateLevel(10_000)).toBe(66);
    // 100 000 XP → niveau 666
    expect(calculateLevel(100_000)).toBe(666);
  });

  it('grands nombres (formule directe O(1) sans cap)', () => {
    expect(calculateLevel(1_000_000)).toBe(6666);
    expect(calculateLevel(10_000_000)).toBe(66666);
    expect(calculateLevel(1_000_000_000)).toBe(6666666);
  });

  it('valeurs invalides → 0', () => {
    expect(calculateLevel(-1)).toBe(0);
    expect(calculateLevel(Number.NaN)).toBe(0);
    expect(calculateLevel(Number.POSITIVE_INFINITY)).toBe(0);
    expect(calculateLevel(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('xp fractionnaire → floor', () => {
    expect(calculateLevel(150.5)).toBe(1);
    expect(calculateLevel(299.9)).toBe(1);
    expect(calculateLevel(300.1)).toBe(2);
    expect(calculateLevel(0.99)).toBe(0);
  });
});

describe('calculateXpForLevel', () => {
  it('niveau 0 → 0 XP', () => {
    expect(calculateXpForLevel(0)).toBe(0);
  });

  it('niveau 1 → 150 XP', () => {
    expect(calculateXpForLevel(1)).toBe(Math.floor(100 * 1 * 1.5));
  });

  it('niveau 10 → 1500 XP', () => {
    expect(calculateXpForLevel(10)).toBe(Math.floor(100 * 10 * 1.5));
  });

  it('relation linéaire : level 5 → 750, level 100 → 15000', () => {
    expect(calculateXpForLevel(5)).toBe(750);
    expect(calculateXpForLevel(100)).toBe(15_000);
  });

  it('valeurs invalides → 0', () => {
    expect(calculateXpForLevel(-1)).toBe(0);
    expect(calculateXpForLevel(Number.NaN)).toBe(0);
    expect(calculateXpForLevel(Number.POSITIVE_INFINITY)).toBe(0);
    expect(calculateXpForLevel(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('niveau non-entier → floor avant multiplication', () => {
    expect(calculateXpForLevel(1.5)).toBe(150);
    expect(calculateXpForLevel(2.9)).toBe(300);
  });

  it('overflow → 0', () => {
    expect(calculateXpForLevel(1e308)).toBe(0);
  });
});

describe('calculateXpForNextLevel (sans formule personnalisée)', () => {
  it('xp=0 (level 0) → seuil niveau 1 = 150', () => {
    expect(calculateXpForNextLevel(0)).toBe(150);
  });

  it('xp=200 (level 1) → seuil niveau 2 = 300', () => {
    const currentLevel = calculateLevel(200);
    expect(currentLevel).toBe(1);
    expect(calculateXpForNextLevel(200)).toBe(300);
  });

  it('xp=300 (level 2) → seuil niveau 3 = 450', () => {
    expect(calculateXpForNextLevel(300)).toBe(450);
  });

  it('équivaut à calculateXpForLevel(calculateLevel(xp) + 1)', () => {
    const xp = 1234;
    expect(calculateXpForNextLevel(xp)).toBe(calculateXpForLevel(calculateLevel(xp) + 1));
  });

  it('formule personnalisée : "200 * level"', () => {
    // level actuel = 2 (300 ≤ xp < 450)
    const xp = 400;
    expect(calculateLevel(xp)).toBe(2);
    // prochain niveau = 3 → 200 * 3 = 600
    expect(calculateXpForNextLevel(xp, '200 * level')).toBe(600);
  });

  it('formule personnalisée invalide → fallback formule par défaut', () => {
    const xp = 400;
    expect(calculateXpForNextLevel(xp, 'invalid !!!')).toBe(calculateXpForLevel(3));
  });

  it('formule personnalisée retourne ≤ 0 → fallback', () => {
    const xp = 400;
    expect(calculateXpForNextLevel(xp, '-10')).toBe(calculateXpForLevel(3));
  });
});

describe('calculateXpForNextLevel (edge cases)', () => {
  it('xp invalide → 0 → next = 150', () => {
    expect(calculateXpForNextLevel(-1)).toBe(150);
    expect(calculateXpForNextLevel(Number.NaN)).toBe(150);
  });

  it('xp = très grand nombre', () => {
    // level = 666666, next level = 666667 → 100_000_050 XP
    const xp = 100_000_000;
    expect(calculateXpForNextLevel(xp)).toBe(100_000_050);
  });
});

describe('getXpForCurrentLevel', () => {
  it('xp=0 → currentLevel=0 → seuil=0', () => {
    expect(getXpForCurrentLevel(0)).toBe(0);
  });

  it('xp=200 (level 1) → seuil niveau 1 = 150', () => {
    expect(getXpForCurrentLevel(200)).toBe(150);
  });

  it('xp=300 (level 2) → seuil niveau 2 = 300', () => {
    expect(getXpForCurrentLevel(300)).toBe(300);
  });

  it('xp=500 (level 3) → seuil niveau 3 = 450', () => {
    expect(getXpForCurrentLevel(500)).toBe(450);
  });
});

describe('getXpRemainingToNextLevel', () => {
  it('xp=0 → 150 XP restant pour level 1', () => {
    expect(getXpRemainingToNextLevel(0)).toBe(150);
  });

  it('xp=200 (level 1) → 300-200 = 100 XP restant', () => {
    expect(getXpRemainingToNextLevel(200)).toBe(100);
  });

  it('xp=300 (début level 2) → 450-300 = 150 XP restant', () => {
    expect(getXpRemainingToNextLevel(300)).toBe(150);
  });

  it('xp=400 (level 2) → 450-400 = 50 XP restant', () => {
    expect(getXpRemainingToNextLevel(400)).toBe(50);
  });

  it('xp=449 (level 2, quasi level 3) → 450-449 = 1 XP restant', () => {
    expect(getXpRemainingToNextLevel(449)).toBe(1);
  });

  it('xp=450 (début level 3) → 600-450 = 150 XP restant', () => {
    expect(getXpRemainingToNextLevel(450)).toBe(150);
  });

  it('ne retourne jamais négatif', () => {
    expect(getXpRemainingToNextLevel(100_000)).toBeGreaterThanOrEqual(0);
  });

  it('formule personnalisée', () => {
    // xp=400 (level 2 par défaut), prochain = 3, custom = 200*3=600, restant = 600-400=200
    expect(getXpRemainingToNextLevel(400, '200 * level')).toBe(200);
  });
});

describe('Inverses : calculateLevel ○ calculateXpForLevel', () => {
  it('calculateLevel(calculateXpForLevel(n)) === n pour n ≥ 0', () => {
    for (const n of [0, 1, 2, 5, 10, 50, 100, 500, 1000]) {
      expect(calculateLevel(calculateXpForLevel(n))).toBe(n);
    }
  });

  it('calculateXpForLevel(calculateLevel(xp)) ≤ xp < calculateXpForLevel(calculateLevel(xp) + 1)', () => {
    for (const xp of [0, 1, 149, 150, 200, 299, 300, 500, 1000, 10_000, 100_000]) {
      const level = calculateLevel(xp);
      const threshold = calculateXpForLevel(level);
      const nextThreshold = calculateXpForLevel(level + 1);
      expect(threshold).toBeLessThanOrEqual(xp);
      expect(xp).toBeLessThan(nextThreshold);
    }
  });
});
