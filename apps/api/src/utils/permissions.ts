/**
 * Fichier pont : ré-exporte les helpers de permissions depuis @pinguin/shared
 * pour éviter les duplications et assurer une source de vérité unique.
 *
 * Ce fichier existe pour compatibilité avec les imports existants dans l'API.
 * Toute nouvelle utilisation doit importer directement depuis @pinguin/shared.
 */
export {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasDiscordPermission,
  canManageGuild,
  combinePermissions,
  evaluatePermissions,
  canAccessModule,
  PERMISSION_BITFIELD,
  DISCORD_PERMISSIONS,
  GUILD_ADMIN_PERMISSIONS,
  OWNER_PERMISSIONS,
  MODULE_PERMISSION_MAP,
  DASHBOARD_ACCESS_FIELD_MAP,
  DASHBOARD_MODULES,
  getPermissionLevelMask,
} from '@pinguin/shared';

export type { PermissionFlag, DiscordPermissionFlag, CombinedPermissions } from '@pinguin/shared';
