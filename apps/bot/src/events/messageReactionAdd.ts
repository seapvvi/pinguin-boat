import { MessageReaction, User, Client, PartialMessageReaction, PartialUser } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../services/user';
import { isModuleEnabled } from '../guards/module';
import { 
  getStarboardSettings, 
  getStarboardEntry, 
  createStarboardEntry, 
  updateStarboardEntry, 
  deleteStarboardEntry 
} from '../services/starboard';
import { createEmbed } from '../services/embed';

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

  const guildId = reaction.message.guildId;
  const messageId = reaction.message.id;

  // Suggestions module
  if (await isModuleEnabled(guildId, 'suggestions')) {
    const suggestion = await prisma.suggestion.findFirst({
      where: { messageId, guildId },
    });
    if (suggestion && suggestion.status === 'PENDING') {
      const voters: Record<string, 'up' | 'down'> = JSON.parse(suggestion.voters || '{}');

      if (reaction.emoji.name === '👍' || reaction.emoji.name === '✅') {
        voters[user.id] = 'up';
      } else if (reaction.emoji.name === '👎' || reaction.emoji.name === '❌') {
        voters[user.id] = 'down';
      } else return;

      const upvotes = Object.values(voters).filter((v) => v === 'up').length;
      const downvotes = Object.values(voters).filter((v) => v === 'down').length;

      await prisma.suggestion.update({
        where: { id: suggestion.id },
        data: { upvotes, downvotes, voters: JSON.stringify(voters) },
      });
      return;
    }
  }

  // Polls module
  if (await isModuleEnabled(guildId, 'polls')) {
    const poll = await prisma.poll.findFirst({
      where: { messageId, guildId, status: 'OPEN' },
    });
    if (poll) {
      if (!reaction.emoji.name || !numberEmojis.includes(reaction.emoji.name)) return;

      const optionIndex = numberEmojis.indexOf(reaction.emoji.name);
      const options = JSON.parse(poll.options);
      if (optionIndex < 0 || optionIndex >= options.length) return;

      const dbUser = await ensureUser(user.id, user.username ?? user.id, user.displayAvatarURL?.() ?? null);

      await prisma.pollVote.upsert({
        where: { pollId_userId: { pollId: poll.id, userId: dbUser.id } },
        update: { optionIndex },
        create: { pollId: poll.id, userId: dbUser.id, optionIndex },
      });
      return;
    }
  }

  // Starboard module
  if (await isModuleEnabled(guildId, 'starboard')) {
    const starSettings = await getStarboardSettings(guildId);
    if (!starSettings.enabled || !starSettings.channelId) return;

    // Check if this is the star emoji
    if (reaction.emoji.name !== starSettings.starEmoji) return;

    // Check self-star restriction
    if (!starSettings.selfStar && reaction.message.authorId === user.id) return;

    // Get star count
    const starCount = reaction.count;
    
    if (starCount < starSettings.minStars) return;

    // Check if entry already exists
    let entry = await getStarboardEntry(guildId, messageId);

    if (!entry) {
      // Create new starboard entry
      const message = reaction.message;
      const content = message.content || '';
      const attachment = message.attachments.first()?.url;

      entry = await createStarboardEntry(
        guildId,
        messageId,
        message.authorId,
        content,
        attachment
      );

      // Post to starboard channel
      try {
        const starboardChannel = await reaction.message.guild?.channels.fetch(starSettings.channelId);
        if (!starboardChannel || !starboardChannel.isTextBased()) return;

        const starboardEmbed = createEmbed('starboard')
          .setAuthor({
            name: message.author?.username || 'Utilisateur inconnu',
            iconURL: message.author?.displayAvatarURL(),
          })
          .setDescription(content || '*Aucun contenu textuel*')
          .addFields(
            { name: 'Auteur', value: `<@${message.authorId}>`, inline: true },
            { name: 'Salon', value: `<#${message.channelId}>`, inline: true },
            { name: '⭐', value: `${starCount}`, inline: true }
          )
          .setTimestamp(message.createdTimestamp)
          .setFooter({ text: `Message ID: ${messageId}` });

        if (attachment) {
          starboardEmbed.setImage(attachment);
        }

        const starMessage = await starboardChannel.send({
          content: `${starSettings.starEmoji} **${starCount}**`,
          embeds: [starboardEmbed],
        });

        // Update entry with starboard message ID
        await updateStarboardEntry(entry.id, {
          starCount,
          starboardId: starMessage.id,
        });
      } catch (err) {
        console.error('Error posting to starboard:', err);
        // Delete entry if posting failed
        await deleteStarboardEntry(entry.id);
      }
    } else {
      // Update existing entry
      await updateStarboardEntry(entry.id, { starCount });

      // Update starboard message if it exists
      if (entry.starboardId) {
        try {
          const starboardChannel = await reaction.message.guild?.channels.fetch(starSettings.channelId);
          if (!starboardChannel || !starboardChannel.isTextBased()) return;

          const starMessage = await starboardChannel.messages.fetch(entry.starboardId);
          await starMessage.edit({
            content: `${starSettings.starEmoji} **${starCount}**`,
          });
        } catch (err) {
          console.error('Error updating starboard message:', err);
        }
      }
    }
  }
}
