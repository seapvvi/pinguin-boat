import { prisma, type ModuleEnabled } from '@pinguin/db';
import { getCache, setCache, invalidateCache } from '../utils/cache';

const moduleFieldMap: Record<string, keyof ModuleEnabled> = {
  moderation: 'moderation',
  protection: 'protection',
  tickets: 'tickets',
  logs: 'logs',
  levels: 'levels',
  economy: 'economy',
  music: 'music',
  giveaways: 'giveaways',
  polls: 'polls',
  suggestions: 'suggestions',
  welcome: 'welcome',
  autoroles: 'autoroles',
  embeds: 'embeds',
  minigames: 'minigames',
  starboard: 'starboard',
  forms: 'forms',
  clans: 'clans',
  notifications: 'notifications',
};

export async function isModuleEnabled(guildId: string, moduleName: string): Promise<boolean> {
  const field = moduleFieldMap[moduleName.toLowerCase()];
  if (!field) return true;

  try {
    const cacheKey = `modules:${guildId}`;
    let modules = getCache<ModuleEnabled>(cacheKey);
    if (!modules) {
      modules = await prisma.moduleEnabled.findUnique({ where: { guildId } });
      if (!modules) {
        modules = await prisma.moduleEnabled.upsert({
          where: { guildId },
          update: {},
          create: { guildId },
        });
      }
      setCache(cacheKey, modules, 30_000);
    }
    return (modules[field] as boolean) ?? true;
  } catch {
    return true;
  }
}

export function invalidateModuleCache(guildId: string): void {
  invalidateCache(`modules:${guildId}`);
}

export async function requireModule(
  guildId: string,
  moduleName: string
): Promise<{ enabled: boolean; message?: string }> {
  const enabled = await isModuleEnabled(guildId, moduleName);
  if (!enabled) {
    return {
      enabled: false,
      message: `Le module **${moduleName}** est désactivé sur ce serveur.`,
    };
  }
  return { enabled: true };
}
