import { Message, PartialMessage, Client, EmbedBuilder } from 'discord.js';
import { sendGuildLog } from '../services/logs';

export async function execute(
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage,
  client: Client
): Promise<void> {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.partial) {
    try { await oldMessage.fetch(); } catch { return; }
  }
  if (newMessage.partial) {
    try { await newMessage.fetch(); } catch { return; }
  }

  const before = oldMessage.content ?? '';
  const after = newMessage.content ?? '';
  if (before === after) return;

  await sendGuildLog(
    client,
    newMessage.guild.id,
    'MESSAGE_EDIT',
    new EmbedBuilder({
      title: '✏️ Message modifié',
      color: 0xffaa00,
      fields: [
        { name: 'Auteur', value: `<@${newMessage.author?.id}>`, inline: true },
        { name: 'Salon', value: `<#${newMessage.channel.id}>`, inline: true },
        { name: 'Avant', value: before.slice(0, 1024) || '*vide*' },
        { name: 'Après', value: after.slice(0, 1024) || '*vide*' },
      ],
      timestamp: new Date().toISOString(),
    })
  );
}
