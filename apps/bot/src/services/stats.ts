import { prisma } from '@pinguin/db';
import { Client } from 'discord.js';
import { logger } from '@pinguin/shared';

export interface BotStats {
  guilds: number;
  members: number;
  commands_executed: number;
  uptime: string;
}

export async function incrementCommandsExecuted(): Promise<void> {
  try {
    await prisma.botMetric.upsert({
      where: { key: 'commands_executed' },
      update: { value: { increment: BigInt(1) } },
      create: { key: 'commands_executed', value: BigInt(1) },
    });
  } catch (err) {
    logger.error('Impossible d\'incrémenter le compteur de commandes', { err });
  }
}

export async function getStats(client: Client): Promise<BotStats> {
  const metric = await prisma.botMetric.findUnique({
    where: { key: 'commands_executed' },
  });

  const guilds = client.guilds.cache.size;
  const members = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
  const commandsExecuted = metric?.value ? Number(metric.value) : 0;

  const uptimeSeconds = process.uptime();
  const pct = Math.min(99.9, (uptimeSeconds / 86400) * 100);
  const uptime = Math.round(pct * 10) / 10 + '%';

  return { guilds, members, commands_executed: commandsExecuted, uptime };
}
