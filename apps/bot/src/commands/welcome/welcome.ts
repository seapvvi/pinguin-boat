import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, TextChannel, ChannelType } from 'discord.js';
import { prisma } from '@pinguin/db';
import { infoEmbed, errorEmbed, successEmbed, createEmbed } from '../../services/embed';
import { log } from '../../services/logger';

export const data = new SlashCommandBuilder()
  .setName('welcome')
  .setDescription('Configurer le message de bienvenue')
  .addSubcommand((sub) =>
    sub.setName('test').setDescription('Tester le message de bienvenue')
  )
  .addSubcommand((sub) =>
    sub.setName('set')
      .setDescription('Configurer le salon et message de bienvenue')
      .addChannelOption((opt) =>
        opt.setName('channel').setDescription('Salon de bienvenue').addChannelTypes(ChannelType.GuildText).setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('message').setDescription('Message de bienvenue ({user} pour mention, {server} pour le nom)').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('toggle')
      .setDescription('Activer/désactiver les messages de bienvenue')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const permissions = true;
export const requireAdmin = true;
export const module = 'welcome';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (!interaction.guild) return;

  switch (subcommand) {
    case 'test': {
      await interaction.deferReply({ ephemeral: true });

      const settings = await prisma.welcomeSettings.findUnique({ where: { guildId: interaction.guild.id } });
      if (!settings?.welcomeChannelId) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Aucun salon de bienvenue configuré.')] });
        return;
      }

      if (!settings.enabled) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Les messages de bienvenue sont désactivés.')] });
        return;
      }

      const channel = interaction.guild.channels.cache.get(settings.welcomeChannelId) as TextChannel;
      if (!channel) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Salon de bienvenue introuvable.')] });
        return;
      }

      const testMessage = (settings.welcomeMessage || 'Bienvenue {user} sur {server} !')
        .replace('{user}', interaction.user.toString())
        .replace('{server}', interaction.guild.name);

      await channel.send(testMessage);
      await interaction.editReply({ embeds: [successEmbed('Test envoyé', `Un message de test a été envoyé dans ${channel}.`)] });
      break;
    }

    case 'set': {
      await interaction.deferReply();

      const channel = interaction.options.get('channel')?.channel as TextChannel;
      const message = interaction.options.get('message')?.value as string;

      await prisma.welcomeSettings.upsert({
        where: { guildId: interaction.guild.id },
        update: { welcomeChannelId: channel.id, welcomeMessage: message, enabled: true },
        create: { guildId: interaction.guild.id, welcomeChannelId: channel.id, welcomeMessage: message, enabled: true },
      });

      await interaction.editReply({
        embeds: [successEmbed('Bienvenue configuré', `Les messages de bienvenue seront envoyés dans ${channel}.\nMessage : ${message}`)],
      });

      log({ level: 'info', message: `Welcome configuré: #${channel.name}`, guildId: interaction.guild.id });
      break;
    }

    case 'toggle': {
      await interaction.deferReply();

      const settings = await prisma.welcomeSettings.findUnique({ where: { guildId: interaction.guild.id } });
      const newState = !settings?.enabled;

      await prisma.welcomeSettings.upsert({
        where: { guildId: interaction.guild.id },
        update: { enabled: newState },
        create: { guildId: interaction.guild.id, enabled: newState },
      });

      await interaction.editReply({
        embeds: [newState
          ? successEmbed('Bienvenue activé', 'Les messages de bienvenue sont maintenant activés.')
          : infoEmbed('Bienvenue désactivé', 'Les messages de bienvenue sont maintenant désactivés.')],
      });
      break;
    }
  }
}
