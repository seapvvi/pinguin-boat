import { describe, expect, it } from 'vitest';
import { canUseCooldown } from './cooldown';

describe('cooldown (daily/work)', () => {
  it("autorise si aucun cooldown n'a été utilisé", () => {
    expect(canUseCooldown(1_000, { lastTimestampMs: null }, 5_000)).toEqual({ allowed: true, remainingMs: 0 });
  });

  it('bloque si on est en dessous de l’expiration', () => {
    // cooldown=5s, last=1000 => expires=6000
    const res = canUseCooldown(2_000, { lastTimestampMs: 1_000 }, 5_000);
    expect(res.allowed).toBe(false);
    expect(res.remainingMs).toBe(4_000);
  });

  it('autorise si le cooldown est terminé', () => {
    // last=1000 => expires=6000
    expect(canUseCooldown(6_000, { lastTimestampMs: 1_000 }, 5_000)).toEqual({ allowed: true, remainingMs: 0 });
    expect(canUseCooldown(6_500, { lastTimestampMs: 1_000 }, 5_000)).toEqual({ allowed: true, remainingMs: 0 });
  });
});

