import { GuildMember, Message, DMChannel } from 'discord.js';

const pending = new Map<string, { code: string; expiresAt: number; verifiedRoleId?: string }>();

function randomCode(length = 5): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function sendCaptcha(member: GuildMember, timeoutMinutes = 5): Promise<void> {
  const code = randomCode();
  const key = `${member.guild.id}:${member.id}`;
  pending.set(key, { code, expiresAt: Date.now() + timeoutMinutes * 60 * 1000 });

  const text = [
    `**Vérification requise** sur **${member.guild.name}**`,
    '',
    `Répondez à ce message avec le code suivant dans les **${timeoutMinutes} minutes** :`,
    '',
    `\`\`\`${code}\`\`\``,
  ].join('\n');

  await member.send(text).catch(() => {});

  setTimeout(async () => {
    const p = pending.get(key);
    if (!p || Date.now() < p.expiresAt) return;
    pending.delete(key);
    if (member.kickable) {
      await member.kick('Captcha non validé').catch(() => {});
    }
  }, timeoutMinutes * 60 * 1000);
}

export async function handleCaptchaDM(message: Message): Promise<boolean> {
  if (message.author.bot || message.guild) return false;

  const userId = message.author.id;
  for (const [key, data] of pending.entries()) {
    if (!key.endsWith(`:${userId}`)) continue;
    if (Date.now() > data.expiresAt) {
      pending.delete(key);
      continue;
    }
    if (message.content.trim().toUpperCase() !== data.code) continue;
    pending.delete(key);
    const guildId = key.split(':')[0];
    const guild = message.client.guilds.cache.get(guildId);
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (member) {
      await message.reply('✅ Vérification réussie ! Bienvenue.').catch(() => {});
    }
    return true;
  }
  return false;
}

export function hasPendingCaptcha(guildId: string, userId: string): boolean {
  return pending.has(`${guildId}:${userId}`);
}
