import { prisma, type ModuleEnabled } from '@pinguin/db';

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
};

export async function isModuleEnabled(guildId: string, moduleName: string): Promise<boolean> {
  const field = moduleFieldMap[moduleName.toLowerCase()];
  if (!field) return true;

  try {
    const modules = await prisma.moduleEnabled.findUnique({ where: { guildId } });
    if (!modules) return true;
    return (modules[field] as boolean) ?? true;
  } catch {
    return true;
  }
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
