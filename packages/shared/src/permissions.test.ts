import { describe, it, expect } from 'vitest';
import {
  PERMISSION_BITFIELD,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  combinePermissions,
  getPermissionLevelMask,
  hasDiscordPermission,
  canManageGuild,
  evaluatePermissions,
  canAccessModule,
  GUILD_ADMIN_PERMISSIONS,
  OWNER_PERMISSIONS,
  MODULE_PERMISSION_MAP,
  DASHBOARD_ACCESS_FIELD_MAP,
  DASHBOARD_MODULES,
} from './permissions';
import { PermissionLevel } from './enums';

describe('PERMISSION_BITFIELD', () => {
  it('devrait avoir 19 flags uniques', () => {
    const flags = Object.values(PERMISSION_BITFIELD);
    const unique = new Set(flags);
    expect(unique.size).toBe(19);
  });

  it('chaque flag devrait être une puissance de 2 différente', () => {
    const flags = Object.values(PERMISSION_BITFIELD);
    for (const f of flags) {
      expect(f > 0n).toBe(true);
      // Vérifie que c'est une puissance de 2
      expect(f & (f - 1n)).toBe(0n);
    }
  });
});

describe('hasPermission', () => {
  const adminPerms = combinePermissions(GUILD_ADMIN_PERMISSIONS);

  it('devrait retourner true pour VIEW_DASHBOARD si admin', () => {
    expect(hasPermission(adminPerms, 'VIEW_DASHBOARD')).toBe(true);
  });

  it('devrait retourner false pour MANAGE_PREMIUM si admin seulement', () => {
    expect(hasPermission(adminPerms, 'MANAGE_PREMIUM')).toBe(false);
  });

  it('devrait retourner true pour MANAGE_PREMIUM si OWNER', () => {
    const ownerPerms = combinePermissions(OWNER_PERMISSIONS);
    expect(hasPermission(ownerPerms, 'MANAGE_PREMIUM')).toBe(true);
  });

  it('devrait retourner false pour un utilisateur sans permissions', () => {
    expect(hasPermission(0n, 'VIEW_DASHBOARD')).toBe(false);
  });
});

describe('hasAnyPermission', () => {
  const perms = combinePermissions(['VIEW_DASHBOARD', 'MANAGE_MODERATION']);

  it('devrait retourner true si au moins un flag est présent', () => {
    expect(hasAnyPermission(perms, ['VIEW_DASHBOARD', 'MANAGE_PREMIUM'])).toBe(true);
  });

  it('devrait retourner false si aucun flag présent', () => {
    expect(hasAnyPermission(perms, ['MANAGE_PREMIUM', 'MANAGE_BLACKLIST'])).toBe(false);
  });
});

describe('hasAllPermissions', () => {
  const perms = combinePermissions(['VIEW_DASHBOARD', 'MANAGE_MODERATION']);

  it('devrait retourner true si tous les flags sont présents', () => {
    expect(hasAllPermissions(perms, ['VIEW_DASHBOARD', 'MANAGE_MODERATION'])).toBe(true);
  });

  it('devrait retourner false si un flag manque', () => {
    expect(hasAllPermissions(perms, ['VIEW_DASHBOARD', 'MANAGE_PREMIUM'])).toBe(false);
  });
});

describe('getPermissionLevelMask', () => {
  it('OWNER devrait avoir tous les flags', () => {
    const mask = getPermissionLevelMask(PermissionLevel.OWNER);
    for (const flag of OWNER_PERMISSIONS) {
      expect(hasPermission(mask, flag)).toBe(true);
    }
  });

  it('GUILD_OWNER devrait avoir les mêmes flags que OWNER', () => {
    const owner = getPermissionLevelMask(PermissionLevel.OWNER);
    const guildOwner = getPermissionLevelMask(PermissionLevel.GUILD_OWNER);
    expect(owner).toBe(guildOwner);
  });

  it('ADMIN devrait avoir GUILD_ADMIN_PERMISSIONS', () => {
    const mask = getPermissionLevelMask(PermissionLevel.ADMIN);
    for (const flag of GUILD_ADMIN_PERMISSIONS) {
      expect(hasPermission(mask, flag)).toBe(true);
    }
    expect(hasPermission(mask, 'MANAGE_PREMIUM')).toBe(false);
  });

  it('MODERATOR et EVERYONE devraient retourner 0n', () => {
    expect(getPermissionLevelMask(PermissionLevel.MODERATOR)).toBe(0n);
    expect(getPermissionLevelMask(PermissionLevel.EVERYONE)).toBe(0n);
  });
});

describe('hasDiscordPermission', () => {
  const ADMIN = 1n << 3n;

  it('devrait retourner true si le bit est présent (string)', () => {
    expect(hasDiscordPermission('8', ADMIN)).toBe(true);
  });

  it('devrait retourner true si le bit est présent (bigint)', () => {
    expect(hasDiscordPermission(8n, ADMIN)).toBe(true);
  });

  it('devrait retourner false si le bit est absent', () => {
    expect(hasDiscordPermission('0', ADMIN)).toBe(false);
  });
});

describe('canManageGuild', () => {
  const ADMINISTRATOR = 1n << 3n;
  const MANAGE_GUILD = 1n << 5n;
  const MANAGE_ROLES = 1n << 28n;

  it('ADMINISTRATOR peut gérer', () => {
    expect(canManageGuild(ADMINISTRATOR)).toBe(true);
  });

  it('MANAGE_GUILD peut gérer', () => {
    expect(canManageGuild(MANAGE_GUILD)).toBe(true);
  });

  it('MANAGE_ROLES peut gérer', () => {
    expect(canManageGuild(MANAGE_ROLES)).toBe(true);
  });

  it('KICK_MEMBERS ne peut pas gérer', () => {
    expect(canManageGuild(1n << 1n)).toBe(false);
  });
});

describe('evaluatePermissions', () => {
  const baseParams = {
    userId: 'user1',
    guildOwnerId: 'owner1',
    memberRoleIds: [] as string[],
    discordPermissions: 0n,
    adminRoleIds: [] as string[],
    modRoleIds: [] as string[],
    dashboardAccessRoleIds: [] as string[],
  };

  it('botOwner → OWNER', () => {
    const result = evaluatePermissions({ ...baseParams, isBotOwner: true });
    expect(result.level).toBe(PermissionLevel.OWNER);
    expect(result.isDiscordAdmin).toBe(false);
  });

  it('guildOwner → GUILD_OWNER', () => {
    const result = evaluatePermissions({ ...baseParams, userId: 'owner1' });
    expect(result.level).toBe(PermissionLevel.GUILD_OWNER);
    expect(result.isOwner).toBe(true);
  });

  it('Discord ADMIN → ADMIN', () => {
    const result = evaluatePermissions({ ...baseParams, discordPermissions: 1n << 3n });
    expect(result.level).toBe(PermissionLevel.ADMIN);
    expect(result.isDiscordAdmin).toBe(true);
  });

  it('adminRoleId → ADMIN', () => {
    const result = evaluatePermissions({ ...baseParams, memberRoleIds: ['admin_role'], adminRoleIds: ['admin_role'] });
    expect(result.level).toBe(PermissionLevel.ADMIN);
  });

  it('modRoleId → MODERATOR', () => {
    const result = evaluatePermissions({ ...baseParams, memberRoleIds: ['mod_role'], modRoleIds: ['mod_role'] });
    expect(result.level).toBe(PermissionLevel.MODERATOR);
    // Les modérateurs devraient avoir VIEW_DASHBOARD et MANAGE_MODERATION
    expect(hasPermission(result.pinguinPermissions, 'VIEW_DASHBOARD')).toBe(true);
    expect(hasPermission(result.pinguinPermissions, 'MANAGE_MODERATION')).toBe(true);
  });

  it('dashboardAccessRole → EVERYONE avec VIEW_DASHBOARD', () => {
    const result = evaluatePermissions({
      ...baseParams,
      memberRoleIds: ['dash_role'],
      dashboardAccessRoleIds: ['dash_role'],
    });
    expect(result.level).toBe(PermissionLevel.EVERYONE);
    expect(hasPermission(result.pinguinPermissions, 'VIEW_DASHBOARD')).toBe(true);
  });

  it('aucun rôle → EVERYONE sans permissions', () => {
    const result = evaluatePermissions(baseParams);
    expect(result.level).toBe(PermissionLevel.EVERYONE);
    expect(result.pinguinPermissions).toBe(0n);
  });
});

describe('canAccessModule', () => {
  it('ADMIN peut toujours accéder', () => {
    const combined = evaluatePermissions({
      userId: 'user1',
      guildOwnerId: 'owner1',
      memberRoleIds: [],
      discordPermissions: 1n << 3n,
      adminRoleIds: [],
      modRoleIds: [],
      dashboardAccessRoleIds: [],
    });
    expect(canAccessModule(combined, 'MANAGE_MODERATION')).toBe(true);
  });

  it('EVERYONE sans permission ne peut pas accéder', () => {
    const combined = evaluatePermissions({
      userId: 'user1',
      guildOwnerId: 'owner1',
      memberRoleIds: [],
      discordPermissions: 0n,
      adminRoleIds: [],
      modRoleIds: [],
      dashboardAccessRoleIds: [],
    });
    expect(canAccessModule(combined, 'MANAGE_MODERATION')).toBe(false);
  });
});

describe('MODULE_PERMISSION_MAP', () => {
  it('toutes les clés devraient correspondre à des flags valides', () => {
    for (const [key, flag] of Object.entries(MODULE_PERMISSION_MAP)) {
      expect(PERMISSION_BITFIELD[flag]).toBeDefined();
    }
  });
});

describe('DASHBOARD_ACCESS_FIELD_MAP', () => {
  it('toutes les clés devraient exister dans MODULE_PERMISSION_MAP', () => {
    for (const key of Object.keys(DASHBOARD_ACCESS_FIELD_MAP)) {
      expect(MODULE_PERMISSION_MAP[key]).toBeDefined();
    }
  });
});

describe('DASHBOARD_MODULES', () => {
  it('chaque module devrait avoir un field valide', () => {
    for (const mod of DASHBOARD_MODULES) {
      expect(DASHBOARD_ACCESS_FIELD_MAP[mod.key]).toBe(mod.field);
    }
  });

  it('chaque module devrait avoir une permission valide', () => {
    for (const mod of DASHBOARD_MODULES) {
      expect(PERMISSION_BITFIELD[mod.permission]).toBeDefined();
    }
  });
});

describe('GUILD_ADMIN_PERMISSIONS vs OWNER_PERMISSIONS', () => {
  it('OWNER devrait inclure tous les GUILD_ADMIN plus premium/blacklist/deployment', () => {
    for (const flag of GUILD_ADMIN_PERMISSIONS) {
      expect(OWNER_PERMISSIONS).toContain(flag);
    }
    expect(OWNER_PERMISSIONS).toContain('MANAGE_PREMIUM');
    expect(OWNER_PERMISSIONS).toContain('MANAGE_BLACKLIST');
    expect(OWNER_PERMISSIONS).toContain('MANAGE_DEPLOYMENT');
  });

  it('GUILD_ADMIN ne devrait pas inclure les flags owner-only', () => {
    expect(GUILD_ADMIN_PERMISSIONS).not.toContain('MANAGE_PREMIUM');
    expect(GUILD_ADMIN_PERMISSIONS).not.toContain('MANAGE_BLACKLIST');
    expect(GUILD_ADMIN_PERMISSIONS).not.toContain('MANAGE_DEPLOYMENT');
  });
});

describe('coverage - tous les flags PERMISSION_BITFIELD sont testés', () => {
  it('tous les flags sont dans GUILD_ADMIN ou OWNER', () => {
    const allFlags = Object.keys(PERMISSION_BITFIELD) as Array<keyof typeof PERMISSION_BITFIELD>;
    const covered = new Set([...GUILD_ADMIN_PERMISSIONS, ...OWNER_PERMISSIONS]);
    for (const flag of allFlags) {
      expect(covered.has(flag)).toBe(true);
    }
  });
});
