import { Collection, CommandInteraction, Client as DiscordClient } from 'discord.js';

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, {
      data: any;
      execute: (interaction: CommandInteraction, client: Client) => Promise<void>;
      autocomplete?: (interaction: any, client: Client) => Promise<void>;
      permissions?: boolean;
      requireAdmin?: boolean;
      cooldown?: number;
      guards?: { cooldown?: boolean };
      module?: string;
    }>;
  }
}

export {};
