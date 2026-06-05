import { GuildMember, Client, EmbedBuilder } from 'discord.js';
import { prisma } from '@pinguin/db';
import { logger } from '@pinguin/shared';
import { handleMemberJoin } from '../services/protection';
import { isModuleEnabled } from '../guards/module';
import { sendGuildLog } from '../services/logs';
import { refreshGuildInvites, findUsedInvite, getCachedInvites } from '../services/invite-cache';
import type { InviteData } from '../services/invite-cache';

export async function execute(member: GuildMember, client: Client): Promise<void> {
  if (member.user.bot) return;
  const guildId = member.guild.id;

  await sendGuildLog(
    client,
    guildId,
    'MEMBER_JOIN',
    new EmbedBuilder({
      title: '👋 Membre rejoint',
      color: 0x00ff88,
      description: `${member.user.username} (\`${member.id}\`)`,
      thumbnail: { url: member.user.displayAvatarURL() },
      timestamp: new Date().toISOString(),
    })
  );

  await handleMemberJoin(member);

  const welcomeEnabled = await isModuleEnabled(guildId, 'welcome');
  if (welcomeEnabled) {
    const welcome = await prisma.welcomeSettings.findUnique({ where: { guildId } });
    if (welcome?.enabled) {
      let inviterName = 'quelqu\'un';
      let inviterId: string | null = null;

      try {
        // 1. Lire le cache actuel AVANT tout rafraîchissement
        const cachedInvites = getCachedInvites(guildId);

        // 2. Récupérer les invites live depuis Discord
        const currentInvites = await member.guild.invites.fetch();
        const currentInvitesMap = new Map<string, InviteData>();

        for (const invite of currentInvites.values()) {
          currentInvitesMap.set(invite.code, {
            uses: invite.uses,
            inviterId: invite.inviterId,
          });
        }

        // 3. Trouver l'invite utilisée par comparaison (ancien cache vs nouvelles valeurs)
        const usedInvite = findUsedInvite(cachedInvites, currentInvitesMap);

        // 4. Rafraîchir le cache avec les nouvelles valeurs
        await refreshGuildInvites(member.guild);
        
        if (usedInvite) {
          inviterId = usedInvite.inviterId;
          if (inviterId) {
            const inviter = await member.guild.members.fetch(inviterId).catch(() => null);
            if (inviter) {
              inviterName = inviter.user.username;
            }
          }
        } else {
          // Cas edge: vanity URL
          const vanityData = await member.guild.fetchVanityData().catch(() => null);
          if (vanityData && vanityData.uses) {
            inviterName = 'vanity URL';
          }
        }
      } catch (error) {
        // Fallback: essayer les audit logs si le cache échoue
        try {
          const logs = await member.guild.fetchAuditLogs({ limit: 1, type: 28 });
          const entry = logs.entries.first();
          if (entry?.executor && !entry.executor.bot) {
            inviterName = entry.executor.username ?? "quelqu'un";
            inviterId = entry.executor.id;
          }
        } catch {
          /* audit log indisponible */
        }
      }

      const replacements = (s: string) => s
            .replace(/\{user\}/gi, member.displayName)
            .replace(/\{username\}/gi, member.user.username)
            .replace(/\{server\}/gi, member.guild.name)
            .replace(/\{members\}/gi, String(member.guild.memberCount))
            .replace(/\{count\}/gi, String(member.guild.memberCount))
            .replace(/\{inviter\}/gi, inviterName);

      if (welcome.welcomeChannelId) {
        const channel = member.guild.channels.cache.get(welcome.welcomeChannelId);
        if (channel?.isTextBased()) {
          const mention = welcome.mentionMember !== false ? `${member} ` : '';
          if (welcome.welcomeEmbed) {
            const embed = new EmbedBuilder()
              .setColor((welcome.welcomeEmbedColor || '#00FF00') as `#${string}`);

            if (welcome.welcomeEmbedTitle) embed.setTitle(replacements(welcome.welcomeEmbedTitle));
            if (welcome.welcomeEmbedDescription) {
              embed.setDescription(replacements(welcome.welcomeEmbedDescription));
            } else if (welcome.welcomeMessage) {
              embed.setDescription(replacements(welcome.welcomeMessage));
            }
            if (welcome.welcomeEmbedFooter) embed.setFooter({ text: replacements(welcome.welcomeEmbedFooter) });
            if (welcome.welcomeEmbedImage) embed.setImage(welcome.welcomeEmbedImage);

            await channel.send({ content: mention || undefined, embeds: [embed] }).catch((err) => logger.warn(`[guildMemberAdd] Échec envoi embed bienvenue dans ${channel.id} pour ${member.id}`, { err: err instanceof Error ? err.message : String(err) }));
          } else {
            const msg = welcome.welcomeMessage
              ? replacements(welcome.welcomeMessage)
              : `Bienvenue ${member.displayName} sur **${member.guild.name}** !`;
            await channel.send(mention + msg).catch((err) => logger.warn(`[guildMemberAdd] Échec envoi message bienvenue dans ${channel.id} pour ${member.id}`, { err: err instanceof Error ? err.message : String(err) }));
          }
        }
      }

      if (welcome.welcomeDM) {
        const dmMsg = (welcome.welcomeDMMessage || `Bienvenue sur **${member.guild.name}**, ${member.user.username} !`)
          .replace(/\{user\}/gi, member.displayName)
          .replace(/\{username\}/gi, member.user.username)
          .replace(/\{server\}/gi, member.guild.name)
          .replace(/\{members\}/gi, String(member.guild.memberCount))
          .replace(/\{count\}/gi, String(member.guild.memberCount))
          .replace(/\{inviter\}/gi, inviterName);
        await member.send(dmMsg).catch((err) => logger.warn(`[guildMemberAdd] Échec envoi DM bienvenue à ${member.id}`, { err: err instanceof Error ? err.message : String(err) }));
      }
    }
  }

  const autorolesEnabled = await isModuleEnabled(guildId, 'autoroles');
  if (autorolesEnabled) {
    const ar = await prisma.autoroleSettings.findUnique({ where: { guildId }, include: { entries: true } });
    if (ar?.enabled && ar.onJoin) {
      const joinRoles = ar.entries.filter((e) => e.type === 'JOIN');
      for (const entry of joinRoles) {
        if (member.roles.cache.has(entry.roleId)) continue;
        const role = member.guild.roles.cache.get(entry.roleId);
        if (!role) continue;
        if (role.position >= member.guild.members.me!.roles.highest.position) continue;
        await member.roles.add(entry.roleId, 'Auto-rôle à l\'arrivée').catch((err) => logger.warn(`[guildMemberAdd] Échec ajout rôle ${entry.roleId} à ${member.id}`, { err: err instanceof Error ? err.message : String(err) }));
      }
    }
  }
}
