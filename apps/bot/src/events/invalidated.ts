import { Client } from 'discord.js';
import { logger } from '@pinguin/shared';

export async function execute(client: Client): Promise<void> {
  logger.error('Session Discord invalidée — le token a peut-être été révoqué', { app: 'bot' });
}
