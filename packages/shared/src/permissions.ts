import { PermissionLevel } from './enums';

// ─── Permissions spécifiques au dashboard Pinguin (bitfield 19 flags) ───

export const PERMISSION_BITFIELD = {
  VIEW_DASHBOARD: 1n << 0n,
  MANAGE_MODERATION: 1n << 1n,
  MANAGE_PROTECTION: 1n << 2n,
  MANAGE_TICKETS: 1n << 3n,
  MANAGE_LOGS: 1n << 4n,
  MANAGE_LEVELS: 1n << 5n,
  MANAGE_ECONOMY: 1n << 6n,
  MANAGE_MUSIC: 1n << 7n,
  MANAGE_GIVEAWAYS: 1n << 8n,
  MANAGE_POLLS: 1n << 9n,
  MANAGE_SUGGESTIONS: 1n << 10n,
  MANAGE_WELCOME: 1n << 11n,
  MANAGE_AUTOROLES: 1n << 12n,
  MANAGE_EMBEDS: 1n << 13n,
  MANAGE_GUILD_SETTINGS: 1n << 14n,
  VIEW_AUDIT_LOG: 1n << 15n,
  MANAGE_PREMIUM: 1n << 16n,
  MANAGE_BLACKLIST: 1n << 17n,
  MANAGE_DEPLOYMENT: 1n << 18n,
} as const;

export type PermissionFlag = keyof typeof PERMISSION_BITFIELD;

// ─── Presets de flags par niveau de permission ───

export const GUILD_ADMIN_PERMISSIONS: PermissionFlag[] = [
  'VIEW_DASHBOARD',
  'MANAGE_MODERATION',
  'MANAGE_PROTECTION',
  'MANAGE_TICKETS',
  'MANAGE_LOGS',
  'MANAGE_LEVELS',
  'MANAGE_ECONOMY',
  'MANAGE_MUSIC',
  'MANAGE_GIVEAWAYS',
  'MANAGE_POLLS',
  'MANAGE_SUGGESTIONS',
  'MANAGE_WELCOME',
  'MANAGE_AUTOROLES',
  'MANAGE_EMBEDS',
  'MANAGE_GUILD_SETTINGS',
  'VIEW_AUDIT_LOG',
];

export const OWNER_PERMISSIONS: PermissionFlag[] = [
  ...GUILD_ADMIN_PERMISSIONS,
  'MANAGE_PREMIUM',
  'MANAGE_BLACKLIST',
  'MANAGE_DEPLOYMENT',
];

// ─── Mapping PermissionLevel → bitfield ───

/** Retourne le masque bigint complet pour un PermissionLevel donné */
export function getPermissionLevelMask(level: PermissionLevel): bigint {
  switch (level) {
    case PermissionLevel.OWNER:
      return OWNER_PERMISSIONS.reduce((acc, p) => acc | PERMISSION_BITFIELD[p], 0n);
    case PermissionLevel.GUILD_OWNER:
      return OWNER_PERMISSIONS.reduce((acc, p) => acc | PERMISSION_BITFIELD[p], 0n);
    case PermissionLevel.ADMIN:
      return GUILD_ADMIN_PERMISSIONS.reduce((acc, p) => acc | PERMISSION_BITFIELD[p], 0n);
    case PermissionLevel.MODERATOR:
      return 0n;
    case PermissionLevel.EVERYONE:
      return 0n;
  }
}

// ─── Discord native permissions (utilisées par l'API) ───

export const DISCORD_PERMISSIONS = {
  ADMINISTRATOR: 1n << 3n,
  MANAGE_GUILD: 1n << 5n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_CHANNELS: 1n << 4n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  MODERATE_MEMBERS: 1n << 40n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  VIEW_CHANNEL: 1n << 10n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
} as const;

export type DiscordPermissionFlag = keyof typeof DISCORD_PERMISSIONS;

/**
 * Vérifie si l'utilisateur a une permission Discord spécifique.
 * Utile pour l'API quand on reçoit le bitfield permissions d'un rôle/membre.
 */
export function hasDiscordPermission(memberPermissions: string | bigint, required: bigint): boolean {
  const perms = typeof memberPermissions === 'string' ? BigInt(memberPermissions) : memberPermissions;
  return (perms & required) === required;
}

/**
 * Vérifie si un membre Discord peut gérer le serveur (Admin, ManageGuild, ou ManageRoles).
 * Cette fonction est utilisée par le middleware `requireGuildAdmin`.
 */
export function canManageGuild(permissions: string | number | bigint): boolean {
  const perms = typeof permissions === 'string' || typeof permissions === 'number'
    ? BigInt(permissions)
    : permissions;
  if (hasDiscordPermission(perms, DISCORD_PERMISSIONS.ADMINISTRATOR)) return true;
  if (hasDiscordPermission(perms, DISCORD_PERMISSIONS.MANAGE_GUILD)) return true;
  if (hasDiscordPermission(perms, DISCORD_PERMISSIONS.MANAGE_ROLES)) return true;
  return false;
}

// ─── Helpers de vérification des flags Pinguin ───

export function hasPermission(userPermissions: bigint, required: PermissionFlag): boolean {
  return (userPermissions & PERMISSION_BITFIELD[required]) === PERMISSION_BITFIELD[required];
}

export function hasAnyPermission(userPermissions: bigint, required: PermissionFlag[]): boolean {
  return required.some((p) => hasPermission(userPermissions, p));
}

export function hasAllPermissions(userPermissions: bigint, required: PermissionFlag[]): boolean {
  return required.every((p) => hasPermission(userPermissions, p));
}

/** Calcule le bitfield combiné d'un ensemble de flags */
export function combinePermissions(flags: PermissionFlag[]): bigint {
  return flags.reduce((acc, f) => acc | PERMISSION_BITFIELD[f], 0n);
}

// ─── Mapping ModuleName → PermissionFlag ───

/**
 * Chaque module du bot/dashboard peut être mappé à une permission spécifique.
 * Cela permet de vérifier qu'un utilisateur a le droit d'accéder/configurer un module.
 */
export const MODULE_PERMISSION_MAP: Record<string, PermissionFlag> = {
  moderation: 'MANAGE_MODERATION',
  protection: 'MANAGE_PROTECTION',
  tickets: 'MANAGE_TICKETS',
  logs: 'MANAGE_LOGS',
  levels: 'MANAGE_LEVELS',
  economy: 'MANAGE_ECONOMY',
  music: 'MANAGE_MUSIC',
  giveaways: 'MANAGE_GIVEAWAYS',
  polls: 'MANAGE_POLLS',
  suggestions: 'MANAGE_SUGGESTIONS',
  welcome: 'MANAGE_WELCOME',
  autoroles: 'MANAGE_AUTOROLES',
  embeds: 'MANAGE_EMBEDS',
  settings: 'MANAGE_GUILD_SETTINGS',
  audit: 'VIEW_AUDIT_LOG',
  premium: 'MANAGE_PREMIUM',
  blacklist: 'MANAGE_BLACKLIST',
  deployment: 'MANAGE_DEPLOYMENT',
};

/** Champ DB correspondant à chaque module dans GuildSettings.dashboard*Access */
export const DASHBOARD_ACCESS_FIELD_MAP: Record<string, string> = {
  moderation: 'dashboardModerationAccess',
  tickets: 'dashboardTicketsAccess',
  polls: 'dashboardPollsAccess',
  suggestions: 'dashboardSuggestionsAccess',
  giveaways: 'dashboardGiveawaysAccess',
  economy: 'dashboardEconomyAccess',
  music: 'dashboardMusicAccess',
  levels: 'dashboardLevelsAccess',
  welcome: 'dashboardWelcomeAccess',
  autoroles: 'dashboardAutorolesAccess',
  logs: 'dashboardLogsAccess',
  protection: 'dashboardProtectionAccess',
  audit: 'dashboardAuditAccess',
};

/**
 * Liste complète des modules dashboard avec leur clé API, leur champ DB,
 * et la permission Pinguin associée.
 */
export const DASHBOARD_MODULES = [
  { key: 'moderation', label: 'Modération', field: 'dashboardModerationAccess', permission: 'MANAGE_MODERATION' as PermissionFlag },
  { key: 'tickets', label: 'Tickets', field: 'dashboardTicketsAccess', permission: 'MANAGE_TICKETS' as PermissionFlag },
  { key: 'polls', label: 'Sondages', field: 'dashboardPollsAccess', permission: 'MANAGE_POLLS' as PermissionFlag },
  { key: 'suggestions', label: 'Suggestions', field: 'dashboardSuggestionsAccess', permission: 'MANAGE_SUGGESTIONS' as PermissionFlag },
  { key: 'giveaways', label: 'Giveaways', field: 'dashboardGiveawaysAccess', permission: 'MANAGE_GIVEAWAYS' as PermissionFlag },
  { key: 'economy', label: 'Économie', field: 'dashboardEconomyAccess', permission: 'MANAGE_ECONOMY' as PermissionFlag },
  { key: 'music', label: 'Musique', field: 'dashboardMusicAccess', permission: 'MANAGE_MUSIC' as PermissionFlag },
  { key: 'levels', label: 'Niveaux / XP', field: 'dashboardLevelsAccess', permission: 'MANAGE_LEVELS' as PermissionFlag },
  { key: 'welcome', label: 'Bienvenue', field: 'dashboardWelcomeAccess', permission: 'MANAGE_WELCOME' as PermissionFlag },
  { key: 'autoroles', label: 'Auto-rôles', field: 'dashboardAutorolesAccess', permission: 'MANAGE_AUTOROLES' as PermissionFlag },
  { key: 'logs', label: 'Logs', field: 'dashboardLogsAccess', permission: 'MANAGE_LOGS' as PermissionFlag },
  { key: 'protection', label: 'Protection', field: 'dashboardProtectionAccess', permission: 'MANAGE_PROTECTION' as PermissionFlag },
  { key: 'audit', label: 'Audit', field: 'dashboardAuditAccess', permission: 'VIEW_AUDIT_LOG' as PermissionFlag },
] as const;

// ─── Helper pour le bot : combine les permissions Discord et DB ───

export interface CombinedPermissions {
  /** Bitfield des permissions Pinguin (dashboard flags) */
  pinguinPermissions: bigint;
  /** PermissionLevel calculé */
  level: PermissionLevel;
  /** true si l'utilisateur est owner du serveur */
  isOwner: boolean;
  /** true si ADMINISTRATOR Discord */
  isDiscordAdmin: boolean;
}

/**
 * Évalue le niveau de permission combiné à partir :
 * - du bitfield des rôles Discord
 * - du fait que l'utilisateur soit owner
 * - des rôles admin/mod définis dans les settings
 * - des rôles dashboard access définis dans les settings
 */
export function evaluatePermissions(
  params: {
    userId: string;
    guildOwnerId: string;
    memberRoleIds: string[];
    discordPermissions: bigint;
    adminRoleIds: string[];
    modRoleIds: string[];
    dashboardAccessRoleIds: string[];
    isBotOwner?: boolean;
  }
): CombinedPermissions {
  const isOwner = params.userId === params.guildOwnerId;
  const isDiscordAdmin = hasDiscordPermission(params.discordPermissions, DISCORD_PERMISSIONS.ADMINISTRATOR);

  if (params.isBotOwner) {
    return {
      pinguinPermissions: getPermissionLevelMask(PermissionLevel.OWNER),
      level: PermissionLevel.OWNER,
      isOwner,
      isDiscordAdmin,
    };
  }

  if (isOwner) {
    return {
      pinguinPermissions: getPermissionLevelMask(PermissionLevel.GUILD_OWNER),
      level: PermissionLevel.GUILD_OWNER,
      isOwner,
      isDiscordAdmin,
    };
  }

  if (isDiscordAdmin) {
    return {
      pinguinPermissions: getPermissionLevelMask(PermissionLevel.ADMIN),
      level: PermissionLevel.ADMIN,
      isOwner,
      isDiscordAdmin,
    };
  }

  const hasAdminRole = params.adminRoleIds.some((r) => params.memberRoleIds.includes(r));
  if (hasAdminRole) {
    return {
      pinguinPermissions: getPermissionLevelMask(PermissionLevel.ADMIN),
      level: PermissionLevel.ADMIN,
      isOwner,
      isDiscordAdmin,
    };
  }

  const hasModRole = params.modRoleIds.some((r) => params.memberRoleIds.includes(r));
  if (hasModRole) {
    return {
      pinguinPermissions: combinePermissions(['VIEW_DASHBOARD', 'MANAGE_MODERATION', 'MANAGE_TICKETS', 'VIEW_AUDIT_LOG']),
      level: PermissionLevel.MODERATOR,
      isOwner,
      isDiscordAdmin,
    };
  }

  // Vérifier les accès dashboard par rôle
  const hasDashboardAccess = params.dashboardAccessRoleIds.some((r) => params.memberRoleIds.includes(r));
  if (hasDashboardAccess) {
    return {
      pinguinPermissions: combinePermissions(['VIEW_DASHBOARD']),
      level: PermissionLevel.EVERYONE,
      isOwner,
      isDiscordAdmin,
    };
  }

  return {
    pinguinPermissions: 0n,
    level: PermissionLevel.EVERYONE,
    isOwner,
    isDiscordAdmin,
  };
}

/**
 * Vérifie si un utilisateur a accès à un module spécifique du dashboard.
 * Les owners et admins Discord ont toujours accès.
 */
export function canAccessModule(
  combined: CombinedPermissions,
  modulePermission: PermissionFlag
): boolean {
  if (combined.level >= PermissionLevel.ADMIN) return true;
  return hasPermission(combined.pinguinPermissions, modulePermission);
}
