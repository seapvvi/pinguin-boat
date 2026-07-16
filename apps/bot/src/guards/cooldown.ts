import { Collection, CommandInteraction, Snowflake } from 'discord.js';
import { prisma } from '@pinguin/db';

const cooldowns = new Collection<string, Collection<Snowflake, number>>();

export interface CooldownCheckResult {
  allowed: boolean;
  message?: string;
  remaining?: number;
}

async function loadCooldowns(): Promise<void> {
  const now = new Date();
  const rows = await prisma.commandCooldown.findMany({
    where: { expiresAt: { gt: now } },
  });
  for (const row of rows) {
    const commandName = row.commandName;
    if (!cooldowns.has(commandName)) {
      cooldowns.set(commandName, new Collection());
    }
    cooldowns.get(commandName)!.set(row.userId as Snowflake, row.expiresAt.getTime());
  }
  // Nettoyer les expirés
  await prisma.commandCooldown.deleteMany({
    where: { expiresAt: { lte: now } },
  });
}

let loaded = false;

export async function checkCooldown(
  interaction: CommandInteraction,
  commandName: string,
  cooldownSeconds: number = 3
): Promise<CooldownCheckResult> {
  if (!loaded) {
    await loadCooldowns();
    loaded = true;
  }

  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(commandName)!;
  const cooldownAmount = cooldownSeconds * 1000;

  if (timestamps.has(interaction.user.id)) {
    const expirationTime = timestamps.get(interaction.user.id)!;

    if (now < expirationTime) {
      const remaining = Math.ceil((expirationTime - now) / 1000);
      return {
        allowed: false,
        remaining,
        message: `Veuillez patienter encore ${remaining} seconde${remaining > 1 ? 's' : ''} avant d'utiliser cette commande.`,
      };
    }
  }

  const expiresAt = now + cooldownAmount;
  timestamps.set(interaction.user.id, expiresAt);
  setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

  await prisma.commandCooldown.upsert({
    where: { userId_commandName: { userId: interaction.user.id, commandName } },
    update: { expiresAt: new Date(expiresAt) },
    create: { userId: interaction.user.id, commandName, expiresAt: new Date(expiresAt) },
  });

  return { allowed: true };
}

export async function setCooldown(
  userId: Snowflake,
  commandName: string,
  cooldownSeconds: number = 3
): Promise<void> {
  if (!loaded) {
    await loadCooldowns();
    loaded = true;
  }

  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(commandName)!;
  const cooldownAmount = cooldownSeconds * 1000;

  const expiresAt = now + cooldownAmount;
  timestamps.set(userId, expiresAt);
  setTimeout(() => timestamps.delete(userId), cooldownAmount);

  await prisma.commandCooldown.upsert({
    where: { userId_commandName: { userId, commandName } },
    update: { expiresAt: new Date(expiresAt) },
    create: { userId, commandName, expiresAt: new Date(expiresAt) },
  });
}

export async function clearCooldowns(userId: Snowflake): Promise<void> {
  for (const [, timestamps] of cooldowns) {
    timestamps.delete(userId);
  }
  await prisma.commandCooldown.deleteMany({ where: { userId } });
}
