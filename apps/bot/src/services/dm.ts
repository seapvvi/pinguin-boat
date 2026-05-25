import { Client, EmbedBuilder } from 'discord.js';

export async function sendDM(client: Client, userId: string, embeds: EmbedBuilder[]): Promise<void> {
  try {
    const user = await client.users.fetch(userId);
    await user.send({ embeds });
  } catch {}
}
