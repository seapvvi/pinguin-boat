import { Guild, User } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, successEmbed, infoEmbed } from './embed';
import { log } from './logger';
import { ensureUser } from './user';
import { logger } from '@pinguin/shared';

interface EscalationResult {
  escalated: boolean;
  action: 'MUTE' | 'BAN' | null;
  reason: string;
}

export async function checkWarnEscalation(
  guild: Guild,
  user: User,
  moderatorId: string
): Promise<EscalationResult> {
  const autoModSettings = await prisma.autoModSettings.findUnique({
    where: { guildId: guild.id },
  });

  if (!autoModSettings) {
    return { escalated: false, action: null, reason: 'Configuration AutoMod non trouvée' };
  }

  const muteThreshold = autoModSettings.autoWarnMuteThreshold;
  const banThreshold = autoModSettings.autoWarnBanThreshold;

  if (!muteThreshold && !banThreshold) {
    return { escalated: false, action: null, reason: 'Aucun seuil configuré' };
  }

  const activeWarnings = await prisma.warning.count({
    where: {
      guildId: guild.id,
      userId: user.id,
      active: true,
    },
  });

  if (banThreshold && activeWarnings >= banThreshold) {
    const result = await applyBan(guild, user, moderatorId, `Seuil de warns atteint (${activeWarnings}/${banThreshold})`);
    return result;
  }

  if (muteThreshold && activeWarnings >= muteThreshold) {
    const result = await applyMute(guild, user, moderatorId, autoModSettings.autoWarnMuteDuration, `Seuil de warns atteint (${activeWarnings}/${muteThreshold})`);
    return result;
  }

  return { escalated: false, action: null, reason: 'Seuil non atteint' };
}

async function applyMute(
  guild: Guild,
  user: User,
  moderatorId: string,
  durationMinutes: number,
  reason: string
): Promise<EscalationResult> {
  const member = guild.members.cache.get(user.id);

  if (!member) {
    return { escalated: false, action: null, reason: 'Membre non trouvé sur le serveur' };
  }

  if (!member.moderatable) {
    return { escalated: false, action: null, reason: 'Membre non modérable' };
  }

  try {
    const durationMs = durationMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + durationMs);
    
    await member.timeout(durationMs, `Escalade automatique: ${reason}`);

    await ensureUser(user.id, user.username, user.avatar);
    await prisma.moderationCase.create({
      data: {
        guildId: guild.id,
        userId: user.id,
        moderatorId,
        type: 'MUTE',
        reason: `Escalade automatique: ${reason}`,
        duration: Math.floor(durationMs / 1000),
        expiresAt,
        active: true,
      },
    });

    try {
      const dmEmbed = infoEmbed('Mute automatique', `Vous avez été rendu muet sur **${guild.name}** suite à trop d'avertissements.`)
        .addFields(
          { name: 'Raison', value: reason },
          { name: 'Durée', value: `${durationMinutes} minutes` }
        );
      await user.send({ embeds: [dmEmbed] });
    } catch {}

    log({ level: 'info', message: `Mute automatique: ${user.username} (${durationMinutes}min)`, guildId: guild.id });

    return { escalated: true, action: 'MUTE', reason: `Mute appliqué pour ${durationMinutes} minutes` };
  } catch (error) {
    logger.error('Erreur lors du mute automatique', { err: error instanceof Error ? error.message : String(error) });
    return { escalated: false, action: null, reason: 'Erreur lors de l\'application du mute' };
  }
}

async function applyBan(
  guild: Guild,
  user: User,
  moderatorId: string,
  reason: string
): Promise<EscalationResult> {
  const member = guild.members.cache.get(user.id);

  if (member) {
    if (!member.bannable) {
      return { escalated: false, action: null, reason: 'Membre non bannissable' };
    }

    if (member.permissions.has('Administrator')) {
      return { escalated: false, action: null, reason: 'Impossible de bannir un administrateur' };
    }
  }

  try {
    await guild.members.ban(user.id, {
      reason: `Escalade automatique: ${reason}`,
    });

    await ensureUser(user.id, user.username, user.avatar);
    await prisma.moderationCase.create({
      data: {
        guildId: guild.id,
        userId: user.id,
        moderatorId,
        type: 'BAN',
        reason: `Escalade automatique: ${reason}`,
        active: true,
      },
    });

    try {
      const dmEmbed = infoEmbed('Bannissement automatique', `Vous avez été banni de **${guild.name}** suite à trop d'avertissements.`)
        .addFields({ name: 'Raison', value: reason });
      await user.send({ embeds: [dmEmbed] });
    } catch {}

    log({ level: 'info', message: `Ban automatique: ${user.username}`, guildId: guild.id });

    return { escalated: true, action: 'BAN', reason: 'Ban appliqué' };
  } catch (error) {
    logger.error('Erreur lors du ban automatique', { err: error instanceof Error ? error.message : String(error) });
    return { escalated: false, action: null, reason: 'Erreur lors de l\'application du ban' };
  }
}
