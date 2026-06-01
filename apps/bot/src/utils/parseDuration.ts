/**
 * Parse une durée en langage naturel et la convertit en millisecondes.
 * Formats supportés : "1h30m", "2d", "1w", "30s", "5m10s", etc.
 * Unités : s (secondes), m (minutes), h (heures), d (jours), w (semaines)
 *
 * @param input - La durée à parser (ex: "1h30m", "2d", "1w", "30s")
 * @returns { milliseconds: number, error: string | null } ou null si format invalide
 */
export function parseDuration(input: string): { milliseconds: number; error: string | null } | null {
  if (!input || typeof input !== 'string') {
    return { milliseconds: 0, error: 'La durée doit être une chaîne de caractères.' };
  }

  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return { milliseconds: 0, error: 'La durée ne peut pas être vide.' };
  }

  // Regex pour capturer les paires nombre+unité (ex: 1h, 30m, 2d)
  const regex = /(\d+)([smhdw])/g;
  let match;
  let totalMilliseconds = 0;
  const foundUnits = new Set<string>();

  while ((match = regex.exec(trimmed)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2];

    if (isNaN(value) || value < 0) {
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

  // Vérifier qu'il n'y a pas de caractères invalides
  const cleanedInput = trimmed.replace(regex, '').trim();
  if (cleanedInput.length > 0) {
    return { milliseconds: 0, error: `Format invalide. Caractères non reconnus : "${cleanedInput}".` };
  }

  if (totalMilliseconds === 0) {
    return { milliseconds: 0, error: 'Aucune durée valide détectée. Utilisez le format : 1h30m, 2d, 1w, 30s, etc.' };
  }

  // Limite maximale : 28 jours (limite Discord)
  const maxDuration = 28 * 24 * 60 * 60 * 1000;
  if (totalMilliseconds > maxDuration) {
    return { milliseconds: 0, error: `La durée ne peut pas excéder 28 jours.` };
  }

  return { milliseconds: totalMilliseconds, error: null };
}

/**
 * Formate une durée en millisecondes en texte lisible (français).
 *
 * @param milliseconds - Durée en millisecondes
 * @returns Chaîne formatée (ex: "1 heure 30 minutes")
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} jour${days > 1 ? 's' : ''}`);
  }
  const remainingHours = hours % 24;
  if (remainingHours > 0) {
    parts.push(`${remainingHours} heure${remainingHours > 1 ? 's' : ''}`);
  }
  const remainingMinutes = minutes % 60;
  if (remainingMinutes > 0) {
    parts.push(`${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`);
  }
  const remainingSeconds = seconds % 60;
  if (remainingSeconds > 0) {
    parts.push(`${remainingSeconds} seconde${remainingSeconds > 1 ? 's' : ''}`);
  }

  if (parts.length === 0) {
    return '0 secondes';
  }

  return parts.join(' ');
}
