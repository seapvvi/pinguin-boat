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

export function hasPermission(
  userPermissions: bigint,
  required: PermissionFlag
): boolean {
  return (userPermissions & PERMISSION_BITFIELD[required]) === PERMISSION_BITFIELD[required];
}

export function hasAnyPermission(
  userPermissions: bigint,
  required: PermissionFlag[]
): boolean {
  return required.some((p) => hasPermission(userPermissions, p));
}

export function hasAllPermissions(
  userPermissions: bigint,
  required: PermissionFlag[]
): boolean {
  return required.every((p) => hasPermission(userPermissions, p));
}
