import { EmbedBuilder, ColorResolvable } from 'discord.js';

const COLORS = {
  success: 0x22c55e as ColorResolvable,
  error: 0xef4444 as ColorResolvable,
  warning: 0xf59e0b as ColorResolvable,
  info: 0x3b82f6 as ColorResolvable,
  default: 0xe0e0e0 as ColorResolvable,
  moderation: 0xf97316 as ColorResolvable,
  music: 0x8b5cf6 as ColorResolvable,
  economy: 0x22d3ee as ColorResolvable,
  giveaway: 0xec4899 as ColorResolvable,
  ticket: 0x14b8a6 as ColorResolvable,
  level: 0x22c55e as ColorResolvable,
  poll: 0xa855f7 as ColorResolvable,
  suggestion: 0x06b6d4 as ColorResolvable,
  welcome: 0xfacc15 as ColorResolvable,
};

export function createEmbed(type: keyof typeof COLORS = 'default', title?: string, description?: string) {
  return new EmbedBuilder()
    .setColor(COLORS[type])
    .setTimestamp();
}

export function successEmbed(title: string, description?: string) {
  return createEmbed('success', title, description)
    .setTitle(title)
    .setDescription(description ?? null);
}

export function errorEmbed(title: string, description?: string) {
  return createEmbed('error', title, description)
    .setTitle(title)
    .setDescription(description ?? null);
}

export function warningEmbed(title: string, description?: string) {
  return createEmbed('warning', title, description)
    .setTitle(title)
    .setDescription(description ?? null);
}

export function infoEmbed(title: string, description?: string) {
  return createEmbed('info', title, description)
    .setTitle(title)
    .setDescription(description ?? null);
}

export { COLORS };
