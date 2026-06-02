/**
 * Parse une durée en langage naturel et la convertit en millisecondes.
 * Formats supportés : "1h30m", "2d", "1w", "30s", "5m10s", etc.
 * Unités : s (secondes), m (minutes), h (heures), d (jours), w (semaines)
 */
export function parseDuration(input: string): { milliseconds: number; error: string | null } | null {
  if (!input || typeof input !== 'string') {
    return { milliseconds: 0, error: 'La durée doit être une chaîne de caractères.' };
  }

  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return { milliseconds: 0, error: 'La durée ne peut pas être vide.' };
  }

  const regex = /(\d+)([smhdw])/g;
  let match: RegExpExecArray | null;
  let totalMilliseconds = 0;
  const foundUnits = new Set<string>();

  while ((match = regex.exec(trimmed)) !== null) {
    const value = Number.parseInt(match[1], 10);
    const unit = match[2];

    if (!Number.isFinite(value) || value < 0) {
      return { milliseconds: 0, error: `Valeur invalide pour l'unité ${unit}.` };
    }

    if (foundUnits.has(unit)) {
      return { milliseconds: 0, error: `L'unité ${unit} est spécifiée plusieurs fois.` };
    }
    foundUnits.add(unit);

    switch (unit) {
      case 's':
        totalMilliseconds += value * 1000;
        break;
      case 'm':
        totalMilliseconds += value * 60 * 1000;
        break;
      case 'h':
        totalMilliseconds += value * 60 * 60 * 1000;
        break;
      case 'd':
        totalMilliseconds += value * 24 * 60 * 60 * 1000;
        break;
      case 'w':
        totalMilliseconds += value * 7 * 24 * 60 * 60 * 1000;
        break;
    }
  }

  const cleanedInput = trimmed.replace(regex, '').trim();
  if (cleanedInput.length > 0) {
    return { milliseconds: 0, error: `Format invalide. Caractères non reconnus : "${cleanedInput}".` };
  }

  if (totalMilliseconds === 0) {
    return {
      milliseconds: 0,
      error: 'Aucune durée valide détectée. Utilisez le format : 1h30m, 2d, 1w, 30s, etc.',
    };
  }

  const maxDuration = 28 * 24 * 60 * 60 * 1000;
  if (totalMilliseconds > maxDuration) {
    return { milliseconds: 0, error: `La durée ne peut pas excéder 28 jours.` };
  }

  return { milliseconds: totalMilliseconds, error: null };
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0s';

  const totalSeconds = Math.floor(ms / 1000);
  const weeks = Math.floor(totalSeconds / (7 * 24 * 3600));
  const days = Math.floor((totalSeconds % (7 * 24 * 3600)) / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  return parts.length > 0 ? parts.join(' ') : '0s';
}

