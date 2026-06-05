import { Guild, Invite } from 'discord.js';
import { logger } from '@pinguin/shared';

interface InviteData {
  uses: number | null;
  inviterId: string | null;
}

type GuildInvites = Map<string, InviteData>;
type InviteCache = Map<string, GuildInvites>;

const inviteCache: InviteCache = new Map();

export function getInviteCache(): InviteCache {
  return inviteCache;
}

export function getGuildInvites(guildId: string): GuildInvites | undefined {
  return inviteCache.get(guildId);
}

export const getCachedInvites = getGuildInvites;

export function setGuildInvites(guildId: string, invites: GuildInvites): void {
  inviteCache.set(guildId, invites);
}

export function deleteGuildInvites(guildId: string): void {
  inviteCache.delete(guildId);
}

export function addInvite(guildId: string, code: string, data: InviteData): void {
  let guildInvites = inviteCache.get(guildId);
  if (!guildInvites) {
    guildInvites = new Map();
    inviteCache.set(guildId, guildInvites);
  }
  guildInvites.set(code, data);
}

export function removeInvite(guildId: string, code: string): void {
  const guildInvites = inviteCache.get(guildId);
  if (guildInvites) {
    guildInvites.delete(code);
  }
}

export function updateInviteUses(guildId: string, code: string, newUses: number): void {
  const guildInvites = inviteCache.get(guildId);
  if (guildInvites) {
    const invite = guildInvites.get(code);
    if (invite) {
      guildInvites.set(code, { ...invite, uses: newUses });
    }
  }
}

export async function initializeInviteCache(guild: Guild): Promise<void> {
  try {
    const invites = await guild.invites.fetch();
    const guildInvites: GuildInvites = new Map();

    for (const invite of invites.values()) {
      guildInvites.set(invite.code, {
        uses: invite.uses,
        inviterId: invite.inviterId,
      });
    }

    inviteCache.set(guild.id, guildInvites);
    logger.info(`Cache d'invites initialisé pour ${guild.name} (${guild.id}) - ${invites.size} invites`, { app: 'bot' });
  } catch (error) {
    logger.error(`Erreur lors de l'initialisation du cache d'invites pour ${guild.id}`, { error, app: 'bot' });
  }
}

export async function refreshGuildInvites(guild: Guild): Promise<void> {
  try {
    const invites = await guild.invites.fetch();
    const guildInvites: GuildInvites = new Map();

    for (const invite of invites.values()) {
      guildInvites.set(invite.code, {
        uses: invite.uses,
        inviterId: invite.inviterId,
      });
    }

    inviteCache.set(guild.id, guildInvites);
  } catch (error) {
    logger.error(`Erreur lors du rafraîchissement des invites pour ${guild.id}`, { error, app: 'bot' });
  }
}

export function findUsedInvite(previousInvites: GuildInvites | undefined, currentInvites: Map<string, InviteData>): { code: string; inviterId: string | null } | null {
  if (!previousInvites) return null;

  for (const [code, currentData] of currentInvites) {
    const previousData = previousInvites.get(code);
    if (!previousData) {
      // Nouvelle invite créée entre-temps
      continue;
    }
    const currentUses = currentData.uses ?? 0;
    const previousUses = previousData.uses ?? 0;
    if (currentUses > previousUses) {
      return { code, inviterId: currentData.inviterId };
    }
  }

  return null;
}
