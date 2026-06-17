export interface CooldownState {
  lastTimestampMs: number | null;
}

export function canUseCooldown(nowMs: number, state: CooldownState, cooldownMs: number): {
  allowed: boolean;
  remainingMs: number;
} {
  if (!Number.isFinite(cooldownMs) || cooldownMs <= 0) {
    return { allowed: true, remainingMs: 0 };
  }

  if (state.lastTimestampMs === null || !Number.isFinite(state.lastTimestampMs)) {
    return { allowed: true, remainingMs: 0 };
  }

  if (!Number.isFinite(nowMs)) {
    return { allowed: true, remainingMs: 0 };
  }

  const expiration = state.lastTimestampMs + cooldownMs;
  if (nowMs < expiration) {
    return { allowed: false, remainingMs: expiration - nowMs };
  }

  return { allowed: true, remainingMs: 0 };
}

export function updateCooldownState(nowMs: number): CooldownState {
  if (!Number.isFinite(nowMs)) {
    return { lastTimestampMs: null };
  }
  return { lastTimestampMs: nowMs };
}

