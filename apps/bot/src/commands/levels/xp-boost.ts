import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, successEmbed, createEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';

interface BoosterRole {
  roleId: string;
  multiplier: number;
}

interface BoosterChannel {
  channelId: string;
  multiplier: number;
}

export const data = new SlashCommandBuilder()
  .setName('xp')
  .setDescription('Gestion du système d\'XP')
  .addSubcommandGroup((group) =>
    group
      .setName('boost')
      .setDescription('Gérer les multiplicateurs d\'XP')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('list')
          .setDescription('Lister les rôles et salons boosteurs')
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('add')
          .setDescription('Ajouter un rôle ou salon boosteur')
          .addRoleOption((opt) =>
            opt.setName('role').setDescription('Rôle boosteur')
          )
          .addChannelOption((opt) =>
            opt.setName('channel').setDescription('Salon boosteur')
          )
          .addNumberOption((opt) =>
            opt.setName('multiplier').setDescription('Multiplicateur d\'XP (ex: 1.5 pour +50%)').setRequired(true).setMinValue(0.1)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('remove')
          .setDescription('Supprimer un rôle ou salon boosteur')
          .addRoleOption((opt) =>
            opt.setName('role').setDescription('Rôle à supprimer')
          )
          .addChannelOption((opt) =>
            opt.setName('channel').setDescription('Salon à supprimer')
          )
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export const permissions = true;
export const module = 'levels';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) return;

  if (!(await isModuleEnabled(interaction.guild.id, 'levels'))) {
    await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'Le module levels est désactivé sur ce serveur.')] });
    return;
  }

  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  if (subcommandGroup === 'boost') {
    if (subcommand === 'list') {
      await handleList(interaction);
    } else if (subcommand === 'add') {
      await handleAdd(interaction);
    } else if (subcommand === 'remove') {
      await handleRemove(interaction);
    }
  }
}

async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const settings = await prisma.xPSettings.findUnique({
      where: { guildId: interaction.guild!.id },
    });

    if (!settings) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Aucune configuration XP trouvée.')] });
      return;
    }

    const boosterRoles: BoosterRole[] = JSON.parse(settings.boosterRoles || '[]');
    const boosterChannels: BoosterChannel[] = JSON.parse(settings.boosterChannels || '[]');

    if (boosterRoles.length === 0 && boosterChannels.length === 0) {
      await interaction.editReply({
        embeds: [errorEmbed('Aucun boosteur', 'Aucun rôle ou salon boosteur n\'est configuré.')]
      });
      return;
    }

    const embed = createEmbed('level')
      .setTitle('🚀 Multiplicateurs d\'XP')
      .setTimestamp();

    if (boosterRoles.length > 0) {
      const roleLines = await Promise.all(boosterRoles.map(async (booster) => {
        const role = await interaction.guild!.roles.fetch(booster.roleId).catch(() => null);
        const roleName = role?.name || booster.roleId;
        return `• <@&${booster.roleId}> (**${roleName}**) : x${booster.multiplier}`;
      }));
      embed.addFields({ name: '👤 Rôles boosteurs', value: roleLines.join('\n') });
    }

    if (boosterChannels.length > 0) {
      const channelLines = await Promise.all(boosterChannels.map(async (booster) => {
        const channel = await interaction.guild!.channels.fetch(booster.channelId).catch(() => null);
        const channelName = channel?.toString() || booster.channelId;
        return `• ${channelName} : x${booster.multiplier}`;
      }));
      embed.addFields({ name: '📢 Salons boosteurs', value: channelLines.join('\n') });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de récupérer la liste des boosteurs.')] });
  }
}

async function handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  const role = interaction.options.getRole('role');
  const channel = interaction.options.getChannel('channel');
  const multiplier = interaction.options.getNumber('multiplier')!;

  if (!role && !channel) {
    await interaction.editReply({
      embeds: [errorEmbed('Erreur', 'Vous devez spécifier un rôle OU un salon.')]
    });
    return;
  }

  if (role && channel) {
    await interaction.editReply({
      embeds: [errorEmbed('Erreur', 'Vous ne pouvez spécifier qu\'un seul élément à la fois.')]
    });
    return;
  }

  try {
    const settings = await prisma.xPSettings.findUnique({
      where: { guildId: interaction.guild!.id },
    });

    if (!settings) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Aucune configuration XP trouvée.')] });
      return;
    }

    if (role) {
      const boosterRoles: BoosterRole[] = JSON.parse(settings.boosterRoles || '[]');
      
      const existingIndex = boosterRoles.findIndex((b) => b.roleId === role.id);
      if (existingIndex !== -1) {
        boosterRoles[existingIndex].multiplier = multiplier;
      } else {
        boosterRoles.push({ roleId: role.id, multiplier });
      }

      await prisma.xPSettings.update({
        where: { guildId: interaction.guild!.id },
        data: { boosterRoles: JSON.stringify(boosterRoles) },
      });

      await interaction.editReply({
        embeds: [successEmbed('Rôle ajouté', `Le rôle <@&${role.id}> a été configuré avec un multiplicateur de x${multiplier}.`)]
      });
    } else if (channel) {
      const boosterChannels: BoosterChannel[] = JSON.parse(settings.boosterChannels || '[]');
      
      const existingIndex = boosterChannels.findIndex((b) => b.channelId === channel.id);
      if (existingIndex !== -1) {
        boosterChannels[existingIndex].multiplier = multiplier;
      } else {
        boosterChannels.push({ channelId: channel.id, multiplier });
      }

      await prisma.xPSettings.update({
        where: { guildId: interaction.guild!.id },
        data: { boosterChannels: JSON.stringify(boosterChannels) },
      });

      await interaction.editReply({
        embeds: [successEmbed('Salon ajouté', `Le salon ${channel} a été configuré avec un multiplicateur de x${multiplier}.`)]
      });
    }
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible d\'ajouter le boosteur.')] });
  }
}

async function handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const role = interaction.options.getRole('role');
  const channel = interaction.options.getChannel('channel');

  if (!role && !channel) {
    await interaction.editReply({
      embeds: [errorEmbed('Erreur', 'Vous devez spécifier un rôle OU un salon.')]
    });
    return;
  }

  if (role && channel) {
    await interaction.editReply({
      embeds: [errorEmbed('Erreur', 'Vous ne pouvez spécifier qu\'un seul élément à la fois.')]
    });
    return;
  }

  try {
    const settings = await prisma.xPSettings.findUnique({
      where: { guildId: interaction.guild!.id },
    });

    if (!settings) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Aucune configuration XP trouvée.')] });
      return;
    }

    if (role) {
      const boosterRoles: BoosterRole[] = JSON.parse(settings.boosterRoles || '[]');
      const filteredRoles = boosterRoles.filter((b) => b.roleId !== role.id);

      if (filteredRoles.length === boosterRoles.length) {
        await interaction.editReply({
          embeds: [errorEmbed('Non trouvé', 'Ce rôle n\'est pas configuré comme boosteur.')]
        });
        return;
      }

      await prisma.xPSettings.update({
        where: { guildId: interaction.guild!.id },
        data: { boosterRoles: JSON.stringify(filteredRoles) },
      });

      await interaction.editReply({
        embeds: [successEmbed('Rôle supprimé', `Le rôle <@&${role.id}> n'est plus un boosteur.`)]
      });
    } else if (channel) {
      const boosterChannels: BoosterChannel[] = JSON.parse(settings.boosterChannels || '[]');
      const filteredChannels = boosterChannels.filter((b) => b.channelId !== channel.id);

      if (filteredChannels.length === boosterChannels.length) {
        await interaction.editReply({
          embeds: [errorEmbed('Non trouvé', 'Ce salon n\'est pas configuré comme boosteur.')]
        });
        return;
      }

      await prisma.xPSettings.update({
        where: { guildId: interaction.guild!.id },
        data: { boosterChannels: JSON.stringify(filteredChannels) },
      });

      await interaction.editReply({
        embeds: [successEmbed('Salon supprimé', `Le salon ${channel} n'est plus un boosteur.`)]
      });
    }
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de supprimer le boosteur.')] });
  }
}
