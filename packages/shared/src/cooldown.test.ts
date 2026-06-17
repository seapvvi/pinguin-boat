import { describe, expect, it } from 'vitest';
import { canUseCooldown, updateCooldownState } from './cooldown';

describe('canUseCooldown', () => {
  it("autorise si aucun cooldown n'a été utilisé", () => {
    expect(canUseCooldown(1_000, { lastTimestampMs: null }, 5_000)).toEqual({ allowed: true, remainingMs: 0 });
  });

  it('bloque si on est en dessous de l’expiration', () => {
    const res = canUseCooldown(2_000, { lastTimestampMs: 1_000 }, 5_000);
    expect(res.allowed).toBe(false);
    expect(res.remainingMs).toBe(4_000);
  });

  it('autorise si le cooldown est terminé', () => {
    expect(canUseCooldown(6_000, { lastTimestampMs: 1_000 }, 5_000)).toEqual({ allowed: true, remainingMs: 0 });
    expect(canUseCooldown(6_500, { lastTimestampMs: 1_000 }, 5_000)).toEqual({ allowed: true, remainingMs: 0 });
  });

  it('cooldownMs = 0 → toujours autorisé', () => {
    expect(canUseCooldown(0, { lastTimestampMs: 1_000 }, 0)).toEqual({ allowed: true, remainingMs: 0 });
    expect(canUseCooldown(1_000, { lastTimestampMs: 1_000 }, 0)).toEqual({ allowed: true, remainingMs: 0 });
  });

  it('cooldownMs < 0 → toujours autorisé', () => {
    expect(canUseCooldown(0, { lastTimestampMs: 1_000 }, -5_000)).toEqual({ allowed: true, remainingMs: 0 });
  });

  it('cooldownMs = NaN → toujours autorisé', () => {
    expect(canUseCooldown(1_000, { lastTimestampMs: 1_000 }, Number.NaN)).toEqual({ allowed: true, remainingMs: 0 });
  });

  it('cooldownMs = Infinity → toujours autorisé', () => {
    expect(canUseCooldown(1_000, { lastTimestampMs: 1_000 }, Number.POSITIVE_INFINITY)).toEqual({ allowed: true, remainingMs: 0 });
  });

  it('lastTimestampMs non-finite → comme null (autorisé)', () => {
    expect(canUseCooldown(1_000, { lastTimestampMs: Number.NaN }, 5_000)).toEqual({ allowed: true, remainingMs: 0 });
    expect(canUseCooldown(1_000, { lastTimestampMs: Number.POSITIVE_INFINITY }, 5_000)).toEqual({ allowed: true, remainingMs: 0 });
  });

  it('nowMs non-finite → autorisé', () => {
    expect(canUseCooldown(Number.NaN, { lastTimestampMs: 1_000 }, 5_000)).toEqual({ allowed: true, remainingMs: 0 });
    expect(canUseCooldown(Number.POSITIVE_INFINITY, { lastTimestampMs: 1_000 }, 5_000)).toEqual({ allowed: true, remainingMs: 0 });
    expect(canUseCooldown(Number.NEGATIVE_INFINITY, { lastTimestampMs: 1_000 }, 5_000)).toEqual({ allowed: true, remainingMs: 0 });
  });
});

describe('updateCooldownState', () => {
  it('stocke le timestamp', () => {
    expect(updateCooldownState(42_000)).toEqual({ lastTimestampMs: 42_000 });
  });

  it('nowMs non-finite → retourne null (reset)', () => {
    expect(updateCooldownState(Number.NaN)).toEqual({ lastTimestampMs: null });
    expect(updateCooldownState(Number.POSITIVE_INFINITY)).toEqual({ lastTimestampMs: null });
  });
});

