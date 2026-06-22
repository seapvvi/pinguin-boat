import { MessageReaction, User, Client, PartialMessageReaction, PartialUser } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../services/user';
import { isModuleEnabled } from '../guards/module';
import { 
  getStarboardSettings, 
  getStarboardEntry, 
  updateStarboardEntry, 
  deleteStarboardEntry 
} from '../services/starboard';
import { logger } from '@pinguin/shared';

const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

export async function execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, _client: Client): Promise<void> {
  if (user.bot) return;
  if (!reaction.message.guildId) return;

  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }
  if (reaction.message.partial) {
    try { await reaction.message.fetch(); } catch { return; }
  }

  // Fetch partials before any use
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error: unknown) {
      logger.error('Erreur lors du fetch de la réaction partielle:', { error: error instanceof Error ? error.message : String(error) });
      return;
    }
  }
  if (reaction.message.partial) {
    try {
      await reaction.message.fetch();
    } catch (error: unknown) {
      logger.error('Erreur lors du fetch du message partiel:', { error: error instanceof Error ? error.message : String(error) });
      return;
    }
  }

  const guildId = reaction.message.guildId;
  const messageId = reaction.message.id;

  const suggestion = await prisma.suggestion.findFirst({
    where: { messageId, guildId },
  });
  if (suggestion && suggestion.status === 'PENDING') {
    const voters: Record<string, 'up' | 'down'> = JSON.parse(suggestion.voters || '{}');
    if (!(user.id in voters)) return;
    delete voters[user.id];

    const upvotes = Object.values(voters).filter((v) => v === 'up').length;
    const downvotes = Object.values(voters).filter((v) => v === 'down').length;

    await prisma.suggestion.update({
      where: { id: suggestion.id },
      data: { upvotes, downvotes, voters: JSON.stringify(voters) },
    });
    return;
  }

  const poll = await prisma.poll.findFirst({
    where: { messageId, guildId, status: 'OPEN' },
  });
  if (poll) {
    if (!reaction.emoji.name || !numberEmojis.includes(reaction.emoji.name)) return;

    const optionIndex = numberEmojis.indexOf(reaction.emoji.name);

    if (poll.anonymous) {
      const lastVote = await prisma.pollVote.findFirst({
        where: { pollId: poll.id, optionIndex },
        orderBy: { createdAt: 'desc' },
      });
      if (lastVote) {
        await prisma.pollVote.delete({ where: { id: lastVote.id } });
      }
    } else {
      const dbUser = await prisma.user.findUnique({ where: { discordId: user.id } });
      if (!dbUser) return;

      await prisma.pollVote.deleteMany({
        where: { pollId: poll.id, userId: dbUser.id, optionIndex },
      });
    }
    return;
  }

  // Starboard module
  if (await isModuleEnabled(guildId, 'starboard')) {
    const starSettings = await getStarboardSettings(guildId);
    // Module on/off is handled by isModuleEnabled above; only a configured
    // channel is required for the starboard to operate.
    if (!starSettings.channelId) return;

    // Check if this is the star emoji
    if (reaction.emoji.name !== starSettings.starEmoji) return;

    // Get star count
    const starCount = reaction.count;
    if (starCount === null) return;

    // Check if entry exists
    const entry = await getStarboardEntry(guildId, messageId);
    if (!entry) return;

    if (starCount < starSettings.minStars) {
      // Remove from starboard if below threshold
      try {
        if (entry.starboardId) {
          const starboardChannel = await reaction.message.guild?.channels.fetch(starSettings.channelId);
          if (starboardChannel && starboardChannel.isTextBased()) {
            const starMessage = await starboardChannel.messages.fetch(entry.starboardId);
            await starMessage.delete();
          }
        }
        await deleteStarboardEntry(entry.id);
      } catch (err) {
        logger.error('Error removing from starboard', { err: err instanceof Error ? err.message : String(err) });
      }
    } else {
      // Update star count
      await updateStarboardEntry(entry.id, { starCount: starCount || undefined });

      // Update starboard message
      if (entry.starboardId) {
        try {
          const starboardChannel = await reaction.message.guild?.channels.fetch(starSettings.channelId);
          if (!starboardChannel || !starboardChannel.isTextBased()) return;

          const starMessage = await starboardChannel.messages.fetch(entry.starboardId);
          await starMessage.edit({
            content: `${starSettings.starEmoji} **${starCount}**`,
          });
        } catch (err) {
          logger.error('Error updating starboard message', { err: err instanceof Error ? err.message : String(err) });
        }
      }
    }
  }
}
