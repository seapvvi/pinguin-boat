import { GuildMember, Message } from 'discord.js';
import { prisma } from '@pinguin/db';

function randomCode(length = 5): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function sendCaptcha(member: GuildMember, timeoutMinutes = 5): Promise<void> {
  const settings = await prisma.protectionSettings.findUnique({ where: { guildId: member.guild.id } });
  const code = randomCode();
  const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

  await prisma.captchaVerification.create({
    data: {
      guildId: member.guild.id,
      userId: member.id,
      code,
      expiresAt,
    },
  });

  const text = [
    `**Vérification requise** sur **${member.guild.name}**`,
    '',
    `Répondez à ce message privé avec le code suivant dans les **${timeoutMinutes} minutes** :`,
    '',
    `\`\`\`${code}\`\`\``,
    '',
    '_Vous ne pourrez pas écrire sur le serveur tant que la vérification n'est pas terminée._',
  ].join('\n');

  const sent = await member.send(text).catch(() => null);
  if (!sent) {
    const ch = member.guild.systemChannel;
    if (ch?.isTextBased()) {
      await ch.send(`${member}, vérifiez vos MP pour le code captcha.`).catch(() => {});
    }
  }
}

export async function handleCaptchaDM(message: Message): Promise<boolean> {
  if (message.author.bot || message.guild) return false;

  const userId = message.author.id;
  const userCode = message.content.trim().toUpperCase();

  const verification = await prisma.captchaVerification.findFirst({
    where: { userId },
  });

  if (!verification) return false;

  const now = new Date();
  if (now > verification.expiresAt) {
    await prisma.captchaVerification.delete({ where: { id: verification.id } });
    const guild = message.client.guilds.cache.get(verification.guildId);
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (member && member.kickable) {
      await member.kick('Captcha expiré').catch(() => {});
    }
    return true;
  }

  if (userCode !== verification.code) {
    await message.reply('❌ Code incorrect. Réessayez.').catch(() => {});
    return true;
  }

  await prisma.captchaVerification.delete({ where: { id: verification.id } });

  const guild = message.client.guilds.cache.get(verification.guildId);
  const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
  if (member) {
    const settings = await prisma.protectionSettings.findUnique({ where: { guildId: verification.guildId } });
    if (settings?.verifiedRoleId) {
      await member.roles.add(settings.verifiedRoleId, 'Captcha validé').catch(() => {});
    }
    await message.reply('✅ Vérification réussie ! Bienvenue sur le serveur.').catch(() => {});
  }
  return true;
}

export async function hasPendingCaptcha(guildId: string, userId: string): Promise<boolean> {
  const verification = await prisma.captchaVerification.findFirst({
    where: { guildId, userId },
  });
  if (!verification) return false;

  const now = new Date();
  if (now > verification.expiresAt) {
    await prisma.captchaVerification.delete({ where: { id: verification.id } });
    return false;
  }
  return true;
}
