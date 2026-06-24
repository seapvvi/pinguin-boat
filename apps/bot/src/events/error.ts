import { Client } from 'discord.js';
import { logger } from '@pinguin/shared';

export const name = 'error';

export async function execute(error: Error, client: Client): Promise<void> {
  logger.error('Erreur WebSocket Discord', { error: error.message, stack: error.stack, app: 'bot' });
}
