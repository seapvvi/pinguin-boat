import { getConfig } from '@pinguin/config';
import { logger } from '@pinguin/shared';

const INTERNAL_SECRET = process.env.BOT_INTERNAL_SECRET || 'dev-secret';

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
        'x-internal-secret': INTERNAL_SECRET,
      },
      body: JSON.stringify({ closedById, guildName }),
    });
  } catch (err) {
    logger.error('[TicketClose] API transcript failed', { err: err instanceof Error ? err.message : String(err) });
  }
}
