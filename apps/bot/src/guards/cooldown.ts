import { Collection, CommandInteraction, Snowflake } from 'discord.js';

const cooldowns = new Collection<string, Collection<Snowflake, number>>();

export interface CooldownCheckResult {
  allowed: boolean;
  message?: string;
  remaining?: number;
}

export function checkCooldown(
  interaction: CommandInteraction,
  commandName: string,
  cooldownSeconds: number = 3
): CooldownCheckResult {
  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(commandName)!;
  const cooldownAmount = cooldownSeconds * 1000;

  if (timestamps.has(interaction.user.id)) {
    const expirationTime = timestamps.get(interaction.user.id)! + cooldownAmount;

    if (now < expirationTime) {
      const remaining = Math.ceil((expirationTime - now) / 1000);
      return {
        allowed: false,
        remaining,
        message: `Veuillez patienter encore ${remaining} seconde${remaining > 1 ? 's' : ''} avant d'utiliser cette commande.`,
      };
    }
  }

  timestamps.set(interaction.user.id, now);
  setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

  return { allowed: true };
}

export function clearCooldowns(userId: Snowflake): void {
  for (const [, timestamps] of cooldowns) {
    timestamps.delete(userId);
  }
}
