export interface CooldownState {
  lastTimestampMs: number | null;
}

export function canUseCooldown(nowMs: number, state: CooldownState, cooldownMs: number): {
  allowed: boolean;
  remainingMs: number;
} {
  if (state.lastTimestampMs === null) {
    return { allowed: true, remainingMs: 0 };
  }

  const expiration = state.lastTimestampMs + cooldownMs;
  if (nowMs < expiration) {
    return { allowed: false, remainingMs: expiration - nowMs };
  }

  return { allowed: true, remainingMs: 0 };
}

export function updateCooldownState(nowMs: number): CooldownState {
  return { lastTimestampMs: nowMs };
}

