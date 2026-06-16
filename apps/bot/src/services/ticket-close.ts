import { getConfig } from '@pinguin/config';
import { logger } from '@pinguin/shared';

function getInternalSecret(): string {
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (!secret) {
    logger.error('[TicketClose] BOT_INTERNAL_SECRET is not set');
    throw new Error('BOT_INTERNAL_SECRET is not configured');
  }
  return secret;
}

export async function closeTicketViaApi(
  ticketId: string,
  closedById: string,
  guildName: string
): Promise<void> {
  const config = getConfig();
  const apiUrl = config.API_URL.replace(/\/$/, '');
  try {
    await fetch(`${apiUrl}/api/internal/tickets/${ticketId}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': getInternalSecret(),
      },
      body: JSON.stringify({ closedById, guildName }),
    });
  } catch (err) {
    logger.error('[TicketClose] API transcript failed', { err: err instanceof Error ? err.message : String(err) });
  }
}
