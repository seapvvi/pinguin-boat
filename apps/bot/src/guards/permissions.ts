import { GuildMember, PermissionResolvable } from 'discord.js';
import { PermissionLevel, evaluatePermissions, canAccessModule, MODULE_PERMISSION_MAP, type PermissionFlag, type CombinedPermissions } from '@pinguin/shared';
import { prisma } from '@pinguin/db';

export interface PermissionCheckResult {
  allowed: boolean;
  message?: string;
}

/**
 * Calcule les permissions combinées d'un membre Discord.
 * Utilise le cache DB pour les rôles admin/mod, et les permissions des rôles Discord.
 */
async function getCombinedPermissions(member: GuildMember): Promise<CombinedPermissions> {
  const settings = await prisma.guildSettings.findUnique({ where: { guildId: member.guild.id } });

  let adminRoleIds: string[] = [];
  let modRoleIds: string[] = [];
  let dashboardAccessRoleIds: string[] = [];
  try {
    if (settings) {
      adminRoleIds = JSON.parse(settings.adminRoleIds);
      modRoleIds = JSON.parse(settings.modRoleIds);
      dashboardAccessRoleIds = JSON.parse(settings.dashboardAccessRoles);
    }
  } catch {
    // données corrompues
  }

  // Calculer le bitfield des permissions Discord du membre
  let discordPermissions = 0n;
  for (const role of member.roles.cache.values()) {
    discordPermissions |= BigInt(role.permissions.bitfield);
  }

  return evaluatePermissions({
    userId: member.id,
    guildOwnerId: member.guild.ownerId,
    memberRoleIds: member.roles.cache.map((r) => r.id),
    discordPermissions,
    adminRoleIds,
    modRoleIds,
    dashboardAccessRoleIds,
    isBotOwner: false, // Le bot ne s'exécute pas pour lui-même sur ses propres serveurs
  });
}

export async function getPermissionLevel(member: GuildMember): Promise<PermissionLevel> {
  const combined = await getCombinedPermissions(member);
  return combined.level;
}

/**
 * Vérifie les permissions Discord d'un membre.
 * Les admins et owners (PermissionLevel >= ADMIN) bypassent la vérification fine.
 */
export async function checkPermissions(
  member: GuildMember,
  requiredPermissions: PermissionResolvable[]
): Promise<PermissionCheckResult> {
  const combined = await getCombinedPermissions(member);

  if (combined.level >= PermissionLevel.ADMIN) return { allowed: true };

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

/**
 * Vérifie les permissions de modération basées sur le PermissionLevel.
 * Si requireAdmin est true, seuls les ADMIN/GUILD_OWNER/OWNER passent.
 * Sinon, les MODERATOR (ou ModerateMembers Discord) passent aussi.
 */
export async function checkModPermissions(
  member: GuildMember,
  requireAdmin: boolean = false
): Promise<PermissionCheckResult> {
  const combined = await getCombinedPermissions(member);

  if (combined.level >= PermissionLevel.GUILD_OWNER) return { allowed: true };

  if (requireAdmin) {
    if (combined.level < PermissionLevel.ADMIN) {
      return {
        allowed: false,
        message: 'Seuls les administrateurs peuvent utiliser cette commande.',
      };
    }
    return { allowed: true };
  }

  if (combined.level >= PermissionLevel.MODERATOR) return { allowed: true };

  if (member.permissions.has('ModerateMembers')) {
    return { allowed: true };
  }

  return {
    allowed: false,
    message: 'Vous n\'avez pas les permissions de modération nécessaires.',
  };
}

/**
 * Vérifie si un membre a accès à un module spécifique du dashboard.
 */
export async function checkModuleAccess(
  member: GuildMember,
  moduleName: string
): Promise<PermissionCheckResult> {
  const permission = MODULE_PERMISSION_MAP[moduleName];
  if (!permission) {
    // Module sans permission spécifique => accès libre si VIEW_DASHBOARD
    return { allowed: true };
  }

  const combined = await getCombinedPermissions(member);

  if (canAccessModule(combined, permission as PermissionFlag)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    message: 'Vous n\'avez pas accès à ce module.',
  };
}

export { PermissionLevel };
