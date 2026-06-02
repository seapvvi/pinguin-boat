import { SlashCommandBuilder, ChatInputCommandInteraction, Client, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, createEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';
import { logger } from '@pinguin/shared';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Voir le classement du serveur')
  .addSubcommand((subcommand) =>
    subcommand.setName('xp').setDescription('Voir le classement XP du serveur')
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('vocal').setDescription('Voir le classement vocal du serveur')
  );

export const module = 'levels';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) return;

  if (!(await isModuleEnabled(interaction.guild.id, 'levels'))) {
    await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'Le module levels est désactivé sur ce serveur.')] });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'vocal') {
    await handleVoiceLeaderboard(interaction);
  } else {
    await handleXpLeaderboard(interaction);
  }
}

async function handleXpLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const profiles = await prisma.xPProfile.findMany({
      where: { guildId: interaction.guild!.id },
      orderBy: { xp: 'desc' },
      take: 20,
    });

    if (profiles.length === 0) {
      await interaction.editReply({ embeds: [errorEmbed('Classement vide', 'Aucun membre n\'a encore d\'XP sur ce serveur. Commencez à parler !')] });
      return;
    }

    const lines = await Promise.all(profiles.map(async (p, i) => {
      const member = await interaction.guild!.members.fetch(p.userId).catch(() => null);
      const name = member?.displayName || p.userId.slice(0, 8);
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
      return `${medal} **${name}** — Niveau ${p.level} (${p.xp} XP)`;
    }));

    const embed = createEmbed('level')
      .setTitle('🏆 Classement XP')
      .setDescription(lines.join('\n'))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Erreur lors de la récupération du classement XP', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de récupérer le classement.')] });
  }
}

async function handleVoiceLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const profiles = await prisma.xPProfile.findMany({
      where: { 
        guildId: interaction.guild!.id,
        voiceMinutes: { gt: 0 }
      },
      orderBy: [{ voiceXp: 'desc' }, { voiceMinutes: 'desc' }],
    });

    if (profiles.length === 0) {
      await interaction.editReply({ embeds: [errorEmbed('Classement vide', 'Aucun membre n\'a encore de temps vocal sur ce serveur. Rejoignez un salon vocal !')] });
      return;
    }

    let currentPage = 0;
    const itemsPerPage = 10;
    const totalPages = Math.ceil(profiles.length / itemsPerPage);

    const generateEmbed = async (page: number) => {
      const start = page * itemsPerPage;
      const end = Math.min(start + itemsPerPage, profiles.length);
      const pageProfiles = profiles.slice(start, end);

      const lines = await Promise.all(pageProfiles.map(async (p, i) => {
        const member = await interaction.guild!.members.fetch(p.userId).catch(() => null);
        const name = member?.displayName || p.userId.slice(0, 8);
        const globalRank = start + i + 1;
        const medal = globalRank === 1 ? '🥇' : globalRank === 2 ? '🥈' : globalRank === 3 ? '🥉' : `#${globalRank}`;
        return `${medal} **${name}** — ${p.voiceMinutes} min • ${p.voiceXp} XP`;
      }));

      return createEmbed('level')
        .setTitle('🎤 Classement Vocal')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Page ${page + 1}/${totalPages} • ${profiles.length} membres` })
        .setTimestamp();
    };

    const getActionRow = (page: number) => {
      const row = new ActionRowBuilder<ButtonBuilder>();
      
      if (page > 0) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('◀ Précédent')
            .setStyle(ButtonStyle.Secondary)
        );
      }
      
      if (page < totalPages - 1) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Suivant ▶')
            .setStyle(ButtonStyle.Secondary)
        );
      }
      
      return row;
    };

    const embed = await generateEmbed(currentPage);
    const actionRow = getActionRow(currentPage);

    const message = await interaction.editReply({ 
      embeds: [embed], 
      components: actionRow.components.length > 0 ? [actionRow] : [] 
    });

    if (totalPages <= 1) return;

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ 
          content: 'Seul l\'utilisateur qui a lancé la commande peut naviguer.', 
          ephemeral: true 
        });
        return;
      }

      if (i.customId === 'prev') {
        currentPage = Math.max(0, currentPage - 1);
      } else if (i.customId === 'next') {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
      }

      const newEmbed = await generateEmbed(currentPage);
      const newRow = getActionRow(currentPage);

      await i.update({ 
        embeds: [newEmbed], 
        components: newRow.components.length > 0 ? [newRow] : [] 
      });
    });

    collector.on('end', async () => {
      await message.edit({ components: [] }).catch(() => {});
    });

  } catch (error) {
    logger.error('Erreur lors de la récupération du classement vocal', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de récupérer le classement vocal.')] });
  }
}
