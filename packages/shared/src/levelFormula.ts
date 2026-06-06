export function calculateLevel(xp: number): number {
  if (!Number.isFinite(xp) || xp < 0) {
    return 0;
  }
  let level = 0;
  const maxIter = 10000;
  while (level < maxIter) {
    const required = Math.floor(100 * (level + 1) * 1.5);
    if (required > xp) break;
    level++;
  }
  return level;
}

export function calculateXpForLevel(level: number): number {
  if (!Number.isFinite(level) || level < 0) {
    return 0;
  }
  return Math.floor(100 * level * 1.5);
}

export function calculateXpForNextLevel(currentXp: number): number {
  const currentLevel = calculateLevel(currentXp);
  return calculateXpForLevel(currentLevel + 1);
}

