import { describe, expect, it } from 'vitest';
import { calculateBankInterest } from './economyInterests';

describe('calculateBankInterest', () => {
  it('calcule les intérêts avec floor(bank * rate/100)', () => {
    expect(calculateBankInterest(0, 10)).toBe(0);
    expect(calculateBankInterest(100, 10)).toBe(10);
    expect(calculateBankInterest(101, 10)).toBe(10);
    expect(calculateBankInterest(100, 0)).toBe(0);
    expect(calculateBankInterest(50, 2.5)).toBe(Math.floor(50 * 2.5 / 100));
  });

  it("retourne 0 si valeurs invalides", () => {
    expect(calculateBankInterest(-1, 10)).toBe(0);
    expect(calculateBankInterest(100, -1)).toBe(0);
    expect(calculateBankInterest(Number.NaN, 10)).toBe(0);
  });
});

