import { describe, expect, it } from 'vitest';
import { parseDuration, formatDuration } from './parseDuration';

describe('parseDuration', () => {
  it('parses supports simples', () => {
    expect(parseDuration('30s')).toEqual({ milliseconds: 30_000, error: null });
    expect(parseDuration('5m')).toEqual({ milliseconds: 300_000, error: null });
    expect(parseDuration('2h')).toEqual({ milliseconds: 7_200_000, error: null });
    expect(parseDuration('1d')).toEqual({ milliseconds: 86_400_000, error: null });
    expect(parseDuration('1w')).toEqual({ milliseconds: 604_800_000, error: null });
  });

  it('parses combinaisons (ordre libre)', () => {
    expect(parseDuration('1h30m')).toEqual({ milliseconds: 5_400_000, error: null });
    expect(parseDuration('2d3h')).toEqual({ milliseconds: 183_600_000, error: null });
    expect(parseDuration('30s10m5h')).toEqual({ milliseconds: 5 * 3_600_000 + 10 * 60_000 + 30_000, error: null });
  });

  it('case insensitive + espaces', () => {
    expect(parseDuration('  1H 30m ')).toEqual({ milliseconds: 5_400_000, error: null });
  });

  it("retourne erreur si caractères non reconnus", () => {
    const res = parseDuration('1h xyz');
    expect(res?.milliseconds).toBe(0);
    expect(res?.error).toContain('Caractères non reconnus');
  });

  it("retourne erreur si format vide", () => {
    const res = parseDuration('   ');
    expect(res?.milliseconds).toBe(0);
    expect(res?.error).toContain('ne peut pas être vide');
  });

  it("retourne erreur si unité dupliquée", () => {
    const res = parseDuration('1h2h');
    expect(res?.milliseconds).toBe(0);
    expect(res?.error).toContain('spécifiée plusieurs fois');
  });

  it("bloque si > 28 jours", () => {
    const res = parseDuration('29d');
    expect(res?.milliseconds).toBe(0);
    expect(res?.error).toContain('28 jours');
  });
});

describe('formatDuration', () => {
  it('formate les millisecondes en durées lisibles', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(30_000)).toBe('30s');
    expect(formatDuration(300_000)).toBe('5m');
    expect(formatDuration(7_200_000)).toBe('2h');
    expect(formatDuration(86_400_000)).toBe('1d');
    expect(formatDuration(604_800_000)).toBe('1w');
  });

  it('combine plusieurs unités', () => {
    expect(formatDuration(5_400_000)).toBe('1h 30m');
    expect(formatDuration(183_600_000)).toBe('2d 3h');
    expect(formatDuration(9_366_100)).toBe('2h 36m 6s');
  });

  it("retourne 0s pour les valeurs invalides", () => {
    expect(formatDuration(-1)).toBe('0s');
    expect(formatDuration(Number.NaN)).toBe('0s');
  });
});

