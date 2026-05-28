import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, Role } from 'discord.js';
import { prisma } from '@pinguin/db';
import { infoEmbed, errorEmbed, successEmbed, createEmbed } from '../../services/embed';
import { log } from '../../services/logger';

export const data = new SlashCommandBuilder()
  .setName('autorole')
  .setDescription('Gérer les rôles automatiques')
  .addSubcommand((sub) =>
    sub.setName('add')
      .setDescription('Ajouter un rôle automatique')
      .addRoleOption((opt) => opt.setName('role').setDescription('Rôle à attribuer').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('type')
          .setDescription('Type d\'attribution')
          .addChoices(
            { name: 'À l\'arrivée', value: 'JOIN' },
            { name: 'Par niveau', value: 'LEVEL' }
          )
          .setRequired(true)
      )
      .addIntegerOption((opt) => opt.setName('level').setDescription('Niveau requis (pour le type "level")').setRequired(false))
  )
  .addSubcommand((sub) =>
    sub.setName('remove')
      .setDescription('Retirer un rôle automatique')
      .addRoleOption((opt) => opt.setName('role').setDescription('Rôle à retirer').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName('list')
      .setDescription('Lister les rôles automatiques')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const permissions = true;
export const requireAdmin = true;
export const module = 'autoroles';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (!interaction.guild) return;

  switch (subcommand) {
    case 'add': {
      await interaction.deferReply();

      const role = interaction.options.get('role')?.role as Role;
      const type = interaction.options.get('type')?.value as string;
      const level = interaction.options.get('level')?.value as number | undefined;

      let settings = await prisma.autoroleSettings.findUnique({ where: { guildId: interaction.guild.id } });
      if (!settings) {
        settings = await prisma.autoroleSettings.create({
          data: { guildId: interaction.guild.id },
        });
      }

      const existing = await prisma.autoroleEntry.findFirst({
        where: { guildId: interaction.guild.id, roleId: role.id },
      });

      if (existing) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Ce rôle est déjà configuré comme rôle automatique.')] });
        return;
      }

      await prisma.autoroleEntry.create({
        data: {
          settingsId: settings.id,
          guildId: interaction.guild.id,
          roleId: role.id,
          type: type as any,
          levelRequired: type === 'LEVEL' ? level : null,
        },
      });

      await interaction.editReply({
        embeds: [successEmbed('Rôle ajouté', `Le rôle **${role.name}** a été ajouté comme rôle automatique (type: ${type === 'JOIN' ? 'À l\'arrivée' : 'Par niveau'}${level ? `, niveau ${level}` : ''}).`)],
      });

      log({ level: 'info', message: `Autorole ajouté: ${role.name} (${type})`, guildId: interaction.guild.id });
      break;
    }

    case 'remove': {
      await interaction.deferReply();

      const role = interaction.options.get('role')?.role as Role;

      const entry = await prisma.autoroleEntry.findFirst({
        where: { guildId: interaction.guild.id, roleId: role.id },
      });

      if (!entry) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Ce rôle n\'est pas configuré comme rôle automatique.')] });
        return;
      }

      await prisma.autoroleEntry.delete({ where: { id: entry.id } });

      await interaction.editReply({
        embeds: [successEmbed('Rôle retiré', `Le rôle **${role.name}** a été retiré des rôles automatiques.`)],
      });
      break;
    }

    case 'list': {
      await interaction.deferReply();

      const entries = await prisma.autoroleEntry.findMany({
        where: { guildId: interaction.guild.id },
      });

      if (entries.length === 0) {
        await interaction.editReply({ embeds: [infoEmbed('Rôles automatiques', 'Aucun rôle automatique configuré.')] });
        return;
      }

      const embed = createEmbed('default')
        .setTitle('📋 Rôles automatiques')
        .setDescription(
          entries.map((e) => {
            const typeLabel = e.type === 'JOIN' ? 'À l\'arrivée' : 'Par niveau';
            const levelInfo = e.levelRequired ? ` (niveau ${e.levelRequired})` : '';
            return `<@&${e.roleId}> — ${typeLabel}${levelInfo}`;
          }).join('\n')
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      break;
    }
  }
}
