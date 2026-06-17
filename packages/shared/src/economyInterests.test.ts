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
    expect(calculateBankInterest(10, Number.NaN)).toBe(0);
  });

  it('bank ou interestRate = 0 → 0', () => {
    expect(calculateBankInterest(0, 10)).toBe(0);
    expect(calculateBankInterest(100, 0)).toBe(0);
  });

  it('bank ou interestRate = Infinity → 0', () => {
    expect(calculateBankInterest(Number.POSITIVE_INFINITY, 10)).toBe(0);
    expect(calculateBankInterest(100, Number.POSITIVE_INFINITY)).toBe(0);
    expect(calculateBankInterest(Number.NEGATIVE_INFINITY, 10)).toBe(0);
  });

  it('bank fractionnaire → floor', () => {
    expect(calculateBankInterest(0.5, 10)).toBe(0);
    expect(calculateBankInterest(1.5, 10)).toBe(0);
    expect(calculateBankInterest(10.5, 10)).toBe(1);
  });

  it('interestRate > 100', () => {
    expect(calculateBankInterest(100, 200)).toBe(200);
    expect(calculateBankInterest(50, 1000)).toBe(500);
  });

  it('overflow bank * rate → 0', () => {
    expect(calculateBankInterest(Number.MAX_VALUE, 200)).toBe(0);
  });
});

