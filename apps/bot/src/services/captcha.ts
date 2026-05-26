import { GuildMember, Message } from 'discord.js';
import { prisma } from '@pinguin/db';

const pending = new Map<string, { code: string; expiresAt: number; verifiedRoleId?: string }>();

function randomCode(length = 5): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function sendCaptcha(member: GuildMember, timeoutMinutes = 5): Promise<void> {
  const settings = await prisma.protectionSettings.findUnique({ where: { guildId: member.guild.id } });
  const code = randomCode();
  const key = `${member.guild.id}:${member.id}`;
  pending.set(key, {
    code,
    expiresAt: Date.now() + timeoutMinutes * 60 * 1000,
    verifiedRoleId: settings?.verifiedRoleId ?? undefined,
  });

  const text = [
    `**Vérification requise** sur **${member.guild.name}**`,
    '',
    `Répondez à ce message privé avec le code suivant dans les **${timeoutMinutes} minutes** :`,
    '',
    `\`\`\`${code}\`\`\``,
    '',
    '_Vous ne pourrez pas écrire sur le serveur tant que la vérification n’est pas terminée._',
  ].join('\n');

  const sent = await member.send(text).catch(() => null);
  if (!sent) {
    const ch = member.guild.systemChannel;
    if (ch?.isTextBased()) {
      await ch.send(`${member}, vérifiez vos MP pour le code captcha.`).catch(() => {});
    }
  }

  setTimeout(async () => {
    const p = pending.get(key);
    if (!p) return;
    if (Date.now() < p.expiresAt) return;
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
    if (message.content.trim().toUpperCase() !== data.code) {
      await message.reply('❌ Code incorrect. Réessayez.').catch(() => {});
      return true;
    }
    pending.delete(key);
    const guildId = key.split(':')[0];
    const guild = message.client.guilds.cache.get(guildId);
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (member) {
      if (data.verifiedRoleId) {
        await member.roles.add(data.verifiedRoleId, 'Captcha validé').catch(() => {});
      }
      await message.reply('✅ Vérification réussie ! Bienvenue sur le serveur.').catch(() => {});
    }
    return true;
  }
  return false;
}

export function hasPendingCaptcha(guildId: string, userId: string): boolean {
  const p = pending.get(`${guildId}:${userId}`);
  if (!p) return false;
  if (Date.now() > p.expiresAt) {
    pending.delete(`${guildId}:${userId}`);
    return false;
  }
  return true;
}
