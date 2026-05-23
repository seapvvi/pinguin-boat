import { GuildMember, PermissionResolvable } from 'discord.js';
import { PermissionLevel } from '@pinguin/shared';
import { prisma } from '@pinguin/db';

export interface PermissionCheckResult {
  allowed: boolean;
  message?: string;
}

async function getPermissionLevel(member: GuildMember): Promise<PermissionLevel> {
  if (member.id === member.guild.ownerId) return PermissionLevel.GUILD_OWNER;
  if (member.permissions.has('Administrator')) return PermissionLevel.ADMIN;

  const settings = await prisma.guildSettings.findUnique({ where: { guildId: member.guild.id } });
  if (settings) {
    const adminRoleIds: string[] = JSON.parse(settings.adminRoleIds);
    const modRoleIds: string[] = JSON.parse(settings.modRoleIds);
    if (member.roles.cache.some((r) => adminRoleIds.includes(r.id))) return PermissionLevel.ADMIN;
    if (member.roles.cache.some((r) => modRoleIds.includes(r.id))) return PermissionLevel.MODERATOR;
  }

  return PermissionLevel.EVERYONE;
}

export async function checkPermissions(
  member: GuildMember,
  requiredPermissions: PermissionResolvable[]
): Promise<PermissionCheckResult> {
  const level = await getPermissionLevel(member);

  if (level >= PermissionLevel.ADMIN) return { allowed: true };

  for (const perm of requiredPermissions) {
    if (!member.permissions.has(perm as any)) {
      return {
        allowed: false,
        message: 'Vous n\'avez pas les permissions nécessaires pour utiliser cette commande.',
      };
    }
  }

  return { allowed: true };
}

export async function checkModPermissions(
  member: GuildMember,
  requireAdmin: boolean = false
): Promise<PermissionCheckResult> {
  const level = await getPermissionLevel(member);

  if (level >= PermissionLevel.GUILD_OWNER) return { allowed: true };

  if (requireAdmin) {
    if (level < PermissionLevel.ADMIN) {
      return {
        allowed: false,
        message: 'Seuls les administrateurs peuvent utiliser cette commande.',
      };
    }
    return { allowed: true };
  }

  if (level < PermissionLevel.MODERATOR && !member.permissions.has('ModerateMembers')) {
    return {
      allowed: false,
      message: 'Vous n\'avez pas les permissions de modération nécessaires.',
    };
  }

  return { allowed: true };
}

export { PermissionLevel };
