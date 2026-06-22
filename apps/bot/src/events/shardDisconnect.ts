import { Client, CloseEvent } from 'discord.js';
import { logger } from '@pinguin/shared';

export async function execute(closeEvent: CloseEvent, shardId: number, client: Client): Promise<void> {
  logger.warn('Shard déconnecté', { shardId, code: closeEvent.code, reason: closeEvent.reason, app: 'bot' });
}
