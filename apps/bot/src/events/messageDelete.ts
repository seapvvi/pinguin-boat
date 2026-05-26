import { Message, PartialMessage, Client } from 'discord.js';
import { sendGuildLog } from '../services/logs';

export async function execute(message: Message | PartialMessage, client: Client): Promise<void> {
  if (!message.guild || message.author?.bot) return;
  if (message.partial) {
    try { await message.fetch(); } catch { return; }
  }

  const embed = {
    title: '🗑️ Message supprimé',
    description: message.content?.slice(0, 2000) || '*Aucun contenu texte*',
    color: 0xff4444,
    fields: [
      { name: 'Auteur', value: `<@${message.author?.id}>`, inline: true },
      { name: 'Salon', value: `<#${message.channel.id}>`, inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  const { EmbedBuilder } = await import('discord.js');
  await sendGuildLog(client, message.guild.id, 'MESSAGE_DELETE', new EmbedBuilder(embed));
}
