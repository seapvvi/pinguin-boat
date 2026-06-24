import { Collection, SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, Client as DiscordClient } from 'discord.js';

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, {
      data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
      execute: (interaction: ChatInputCommandInteraction, client: DiscordClient) => Promise<void>;
      autocomplete?: (interaction: AutocompleteInteraction, client: DiscordClient) => Promise<void>;
      permissions?: boolean;
      requireAdmin?: boolean;
      cooldown?: number;
      guards?: { cooldown?: boolean };
      module?: string;
    }>;
  }
}

export {};
