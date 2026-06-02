import { describe, expect, it } from 'vitest';
import { calculateLevel, calculateXpForLevel, calculateXpForNextLevel } from './levelFormula';

describe('levelFormula', () => {
  it('calculateLevel correspond à la formule donnée', () => {
    expect(calculateLevel(0)).toBe(0);
    expect(calculateLevel(1)).toBe(0);
    expect(calculateLevel(100)).toBe(1);
    expect(calculateLevel(10_000)).toBe(Math.floor(0.1 * Math.sqrt(10_000)));
  });

  it('calculateLevel retourne 0 pour les valeurs invalides', () => {
    expect(calculateLevel(-1)).toBe(0);
    expect(calculateLevel(Number.NaN)).toBe(0);
    expect(calculateLevel(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('calculateXpForLevel suit 100 * level * 1.5', () => {
    expect(calculateXpForLevel(0)).toBe(0);
    expect(calculateXpForLevel(1)).toBe(Math.floor(100 * 1 * 1.5));
    expect(calculateXpForLevel(10)).toBe(Math.floor(100 * 10 * 1.5));
  });

  it('calculateXpForLevel retourne 0 pour les valeurs invalides', () => {
    expect(calculateXpForLevel(-1)).toBe(0);
    expect(calculateXpForLevel(Number.NaN)).toBe(0);
  });

  it('calculateXpForNextLevel utilise level+1', () => {
    const currentXp = 1000;
    const currentLevel = calculateLevel(currentXp);
    expect(calculateXpForNextLevel(currentXp)).toBe(calculateXpForLevel(currentLevel + 1));
  });
});

