import { EmbedBuilder, ColorResolvable, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getConfig } from '@pinguin/config';

const config = getConfig();

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
  minigame: 0xff6b6b as ColorResolvable,
  starboard: 0xffd93d as ColorResolvable,
  form: 0x6bcb77 as ColorResolvable,
};

export function createEmbed(type: keyof typeof COLORS = 'default') {
  return new EmbedBuilder()
    .setColor(COLORS[type])
    .setTimestamp();
}

export function successEmbed(title: string, description?: string) {
  return createEmbed('success')
    .setTitle(title)
    .setDescription(description ?? null);
}

export function errorEmbed(title: string, description?: string) {
  return createEmbed('error')
    .setTitle(title)
    .setDescription(description ?? null);
}

export function warningEmbed(title: string, description?: string) {
  return createEmbed('warning')
    .setTitle(title)
    .setDescription(description ?? null);
}

export function infoEmbed(title: string, description?: string) {
  return createEmbed('info')
    .setTitle(title)
    .setDescription(description ?? null);
}

export function enrichedErrorEmbed(title: string, description: string, expected?: string) {
  const embed = createEmbed('error')
    .setTitle('❌ ' + title)
    .setDescription(description);

  if (expected) {
    embed.addFields({
      name: 'Attendu',
      value: expected,
      inline: false,
    });
  }

  embed.setTimestamp();

  return embed;
}

export function enrichedErrorEmbedWithButton(title: string, description: string, expected?: string, docsUrl?: string) {
  const embed = enrichedErrorEmbed(title, description, expected);

  const button = new ButtonBuilder()
    .setLabel('📖 Aide')
    .setStyle(ButtonStyle.Link)
    .setURL(docsUrl || `${config.NEXT_PUBLIC_SITE_URL}/docs`);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  return { embed, components: [row] };
}

export { COLORS };
