import { MessageReaction, User, Client, PartialMessageReaction, PartialUser } from 'discord.js';
import { prisma } from '@pinguin/db';

export async function execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, client: Client): Promise<void> {
  if (user.bot) return;
  if (!reaction.message.guildId) return;

  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }
  if (reaction.message.partial) {
    try { await reaction.message.fetch(); } catch { return; }
  }

  const guildId = reaction.message.guildId;
  const messageId = reaction.message.id;

  const suggestion = await prisma.suggestion.findFirst({
    where: { messageId, guildId },
  });
  if (!suggestion || suggestion.status !== 'PENDING') return;

  const voters: Record<string, 'up' | 'down'> = JSON.parse(suggestion.voters || '{}');
  delete voters[user.id];

  const upvotes = Object.values(voters).filter((v) => v === 'up').length;
  const downvotes = Object.values(voters).filter((v) => v === 'down').length;

  await prisma.suggestion.update({
    where: { id: suggestion.id },
    data: { upvotes, downvotes, voters: JSON.stringify(voters) },
  });
}
