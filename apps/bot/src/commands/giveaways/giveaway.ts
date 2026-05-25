import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { prisma } from '@pinguin/db';
import { infoEmbed, errorEmbed, successEmbed, createEmbed } from '../../services/embed';
import { log } from '../../services/logger';

export const data = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('Gérer les giveaways')
  .addSubcommand((sub) =>
    sub.setName('start')
      .setDescription('Démarrer un giveaway')
      .addStringOption((opt) => opt.setName('prize').setDescription('Lot à gagner').setRequired(true))
      .addIntegerOption((opt) => opt.setName('winners').setDescription('Nombre de gagnants').setRequired(true).setMinValue(1).setMaxValue(20))
      .addStringOption((opt) =>
        opt.setName('duration')
          .setDescription('Durée (ex: 10m, 1h, 1d)')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('reroll')
      .setDescription('Re-tirer les gagnants d\'un giveaway')
      .addStringOption((opt) => opt.setName('message_id').setDescription('ID du message du giveaway').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName('end')
      .setDescription('Terminer un giveaway prématurément')
      .addStringOption((opt) => opt.setName('message_id').setDescription('ID du message du giveaway').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName('cancel')
      .setDescription('Annuler un giveaway')
      .addStringOption((opt) => opt.setName('message_id').setDescription('ID du message du giveaway').setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents);

export const permissions = true;
export const requireAdmin = false;
export const module = 'giveaways';

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 3600;
  const num = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    default: return 3600;
  }
}

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (!interaction.guild) return;

  switch (subcommand) {
    case 'start': {
      await interaction.deferReply();

      const prize = interaction.options.get('prize')?.value as string;
      const winnerCount = interaction.options.get('winners')?.value as number;
      const durationStr = interaction.options.get('duration')?.value as string;
      const durationSeconds = parseDuration(durationStr);
      const endsAt = new Date(Date.now() + durationSeconds * 1000);

      const embed = createEmbed('giveaway')
        .setTitle('🎉 Giveaway !')
        .setDescription(`**${prize}**`)
        .addFields(
          { name: 'Gagnants', value: `${winnerCount}`, inline: true },
          { name: 'Se termine', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
          { name: 'Participants', value: '0', inline: true }
        )
        .setFooter({ text: 'Cliquez sur 🎉 pour participer !' })
        .setTimestamp(endsAt);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('giveaway_join').setLabel('🎉 Participer').setStyle(ButtonStyle.Success)
      );

      const msg = await interaction.editReply({ embeds: [embed], components: [row] });

      const giveaway = await prisma.giveaway.create({
        data: {
          guildId: interaction.guild.id,
          channelId: interaction.channelId,
          messageId: msg.id,
          prize,
          winnerCount,
          duration: durationSeconds,
          endsAt,
          status: 'RUNNING',
        },
      });

      log({ level: 'info', message: `Giveaway démarré: ${prize} (${durationStr})`, guildId: interaction.guild.id });
      break;
    }

    case 'end': {
      await interaction.deferReply({ ephemeral: true });
      const messageId = interaction.options.get('message_id')?.value as string;

      const giveaway = await prisma.giveaway.findFirst({
        where: { messageId, guildId: interaction.guild.id, status: 'RUNNING' },
      });

      if (!giveaway) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Giveaway introuvable ou déjà terminé.')] });
        return;
      }

      const entries = await prisma.giveawayEntry.findMany({ where: { giveawayId: giveaway.id } });
      const userIds = entries.map(e => e.userId);
      const shuffled = [...userIds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const winners = shuffled.slice(0, giveaway.winnerCount);
      const winnersStr = winners.length > 0 ? winners.map(w => `<@${w}>`).join(', ') : 'Aucun participant';

      try {
        const channel = await interaction.guild.channels.fetch(giveaway.channelId);
        if (channel?.isTextBased()) {
          const msg = await channel.messages.fetch(messageId).catch(() => null);
          if (msg) {
            await msg.edit({
              embeds: [{
                title: '🎉 Giveaway terminé',
                description: `**${giveaway.prize}**\n\n**Gagnant(s) :** ${winnersStr}`,
                color: 0x00FF00,
              }],
              components: [],
            });
            if (winners.length > 0) {
              await channel.send(`Félicitations ${winnersStr}! Vous avez gagné **${giveaway.prize}**!`);
            }
          }
        }
      } catch {}

      await prisma.giveaway.update({
        where: { id: giveaway.id },
        data: { status: 'ENDED', endsAt: new Date(), winners: JSON.stringify(winners) },
      });

      await interaction.editReply({ embeds: [successEmbed('Giveaway terminé', `Le giveaway a été terminé. Gagnant(s) : ${winnersStr}`)] });
      break;
    }

    case 'reroll': {
      await interaction.deferReply({ ephemeral: true });
      const messageId = interaction.options.get('message_id')?.value as string;

      const giveaway = await prisma.giveaway.findFirst({
        where: { messageId, guildId: interaction.guild.id, status: 'ENDED' },
      });

      if (!giveaway) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Giveaway introuvable ou pas encore terminé.')] });
        return;
      }

      const entries = await prisma.giveawayEntry.findMany({
        where: { giveawayId: giveaway.id },
      });

      if (entries.length === 0) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Aucune participation à ce giveaway.')] });
        return;
      }

      const shuffled = [...entries];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const winners = shuffled.slice(0, giveaway.winnerCount);

      await interaction.editReply({
        embeds: [successEmbed('Giveaway re-tiré', `Nouveau(x) gagnant(s) : ${winners.map((w) => `<@${w.userId}>`).join(', ')}`)],
      });
      break;
    }

    case 'cancel': {
      await interaction.deferReply({ ephemeral: true });
      const messageId = interaction.options.get('message_id')?.value as string;

      const giveaway = await prisma.giveaway.findFirst({
        where: { messageId, guildId: interaction.guild.id, status: 'RUNNING' },
      });

      if (!giveaway) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Giveaway introuvable ou déjà terminé.')] });
        return;
      }

      await prisma.giveaway.update({
        where: { id: giveaway.id },
        data: { status: 'CANCELLED' },
      });

      try {
        const channel = await interaction.guild.channels.fetch(giveaway.channelId);
        if (channel?.isTextBased()) {
          const msg = await channel.messages.fetch(messageId).catch(() => null);
          if (msg) {
            await msg.edit({ embeds: [errorEmbed('Giveaway annulé', `Le giveaway **${giveaway.prize}** a été annulé.`)], components: [] });
          }
        }
      } catch {}

      await interaction.editReply({ embeds: [successEmbed('Giveaway annulé', 'Le giveaway a été annulé.')] });
      break;
    }
  }
}
