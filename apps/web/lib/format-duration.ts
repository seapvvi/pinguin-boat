export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} seconde${seconds > 1 ? 's' : ''}`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours === 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`
  if (minutes === 0) return `${hours} heure${hours > 1 ? 's' : ''}`
  return `${hours}h ${minutes}min`
}

export function parseDuration(display: string): number | null {
  const match = display.match(/^(?:(\d+)h)?\s*(?:(\d+)min)?$/)
  if (!match) return null
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  return hours * 3600 + minutes * 60
}

export function formatCooldownLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}
