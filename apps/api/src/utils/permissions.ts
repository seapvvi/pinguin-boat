import { PERMISSION_BITFIELD, type PermissionFlag } from '@pinguin/shared';

export function hasPermission(
  userPermissions: bigint,
  required: PermissionFlag
): boolean {
  return (
    (userPermissions & PERMISSION_BITFIELD[required]) ===
    PERMISSION_BITFIELD[required]
  );
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

export function checkGuildPermissions(
  userDiscordId: string,
  guildOwnerId: string,
  userPermissions: bigint,
  required: PermissionFlag
): boolean {
  if (userDiscordId === guildOwnerId) return true;
  return hasPermission(userPermissions, required);
}
