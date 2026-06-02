import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { infoEmbed, successEmbed, errorEmbed, createEmbed } from '../../services/embed';
import { getActiveEvents, setEvent, disableEvent } from '../../services/events';

export const data = new SlashCommandBuilder()
  .setName('event')
  .setDescription('Gérer les événements temporaires du serveur')
  .addSubcommand((sub) =>
    sub.setName('create')
      .setDescription('Créer un événement temporaire')
      .addStringOption((opt) =>
        opt.setName('type')
          .setDescription('Type d\'événement')
          .setRequired(true)
          .addChoices(
            { name: 'Double XP', value: 'double_xp' },
            { name: 'Économie x2', value: 'economy_bonus_x2' },
          )
      )
      .addIntegerOption((opt) =>
        opt.setName('durée')
          .setDescription('Durée en minutes')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(1440)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('list')
      .setDescription('Lister les événements actifs')
  )
  .addSubcommand((sub) =>
    sub.setName('remove')
      .setDescription('Désactiver un événement')
      .addStringOption((opt) =>
        opt.setName('type')
          .setDescription('Type d\'événement à désactiver')
          .setRequired(true)
          .addChoices(
            { name: 'Double XP', value: 'double_xp' },
            { name: 'Économie x2', value: 'economy_bonus_x2' },
          )
      )
  );

export const requireAdmin = true;

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (!interaction.guild) return;

  switch (subcommand) {
    case 'create': {
      await interaction.deferReply();

      const type = interaction.options.getString('type', true);
      const duration = interaction.options.getInteger('durée', true);

      const labels: Record<string, string> = {
        double_xp: 'Double XP',
        economy_bonus_x2: 'Économie x2',
      };

      await setEvent(type, labels[type], undefined, duration);

      const expiresAt = new Date(Date.now() + duration * 60_000);
      const expiresStr = `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`;

      await interaction.editReply({
        embeds: [successEmbed(
          'Événement activé',
          `**${labels[type]}** est maintenant actif pendant **${duration} minute(s)** (expire ${expiresStr}).`
        )],
      });
      break;
    }

    case 'list': {
      await interaction.deferReply();

      const events = await getActiveEvents();

      if (events.length === 0) {
        await interaction.editReply({
          embeds: [infoEmbed('Événements', 'Aucun événement actif pour le moment.')],
        });
        return;
      }

      const embed = createEmbed('default')
        .setTitle('Événements actifs')
        .setDescription(
          events.map((e) => {
            const startStr = e.startsAt ? `<t:${Math.floor(e.startsAt.getTime() / 1000)}:R>` : 'N/A';
            const endStr = e.expiresAt ? `<t:${Math.floor(e.expiresAt.getTime() / 1000)}:R>` : 'N/A';
            return `**${e.name}** (\`${e.key}\`)\nDébut : ${startStr}\nFin : ${endStr}`;
          }).join('\n\n')
        );

      await interaction.editReply({ embeds: [embed] });
      break;
    }

    case 'remove': {
      await interaction.deferReply();

      const type = interaction.options.getString('type', true);

      await disableEvent(type);

      const labels: Record<string, string> = {
        double_xp: 'Double XP',
        economy_bonus_x2: 'Économie x2',
      };

      await interaction.editReply({
        embeds: [successEmbed('Événement désactivé', `**${labels[type]}** a été désactivé.`)],
      });
      break;
    }
  }
}
