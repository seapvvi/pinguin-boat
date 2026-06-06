import { describe, expect, it } from 'vitest';
import { calculateLevel, calculateXpForLevel, calculateXpForNextLevel } from './levelFormula';

describe('levelFormula', () => {
  it('calculateLevel correspond à la formule donnée', () => {
    expect(calculateLevel(0)).toBe(0);
    expect(calculateLevel(1)).toBe(0);
    expect(calculateLevel(149)).toBe(0);
    expect(calculateLevel(150)).toBe(1);
    expect(calculateLevel(299)).toBe(1);
    expect(calculateLevel(300)).toBe(2);
    expect(calculateLevel(450)).toBe(3);
    expect(calculateLevel(10_000)).toBe(66);
  });

  it('calculateXpForLevel suit 100 * level * 1.5', () => {
    expect(calculateXpForLevel(0)).toBe(0);
    expect(calculateXpForLevel(1)).toBe(Math.floor(100 * 1 * 1.5));
    expect(calculateXpForLevel(10)).toBe(Math.floor(100 * 10 * 1.5));
  });

  it('calculateXpForNextLevel utilise level+1', () => {
    const currentXp = 1000;
    const currentLevel = calculateLevel(currentXp);
    expect(calculateXpForNextLevel(currentXp)).toBe(calculateXpForLevel(currentLevel + 1));
  });
});

