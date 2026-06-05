import { SlashCommandBuilder, ChatInputCommandInteraction, Client, GuildMember } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { setLoop, saveQueueToDb, LoopMode, requireDjRole } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('loop')
  .setDescription('Configurer le mode de répétition')
  .addStringOption((opt) =>
    opt.setName('mode')
      .setDescription('Mode de répétition')
      .setRequired(true)
      .addChoices(
        { name: 'Désactivé', value: 'none' },
        { name: 'Répéter la musique', value: 'track' },
        { name: 'Répéter la file', value: 'queue' }
      )
  );

export const module = 'music';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!interaction.guild) return;
  if (!(await requireDjRole(interaction))) return;

  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Vous devez être dans un salon vocal.')], ephemeral: true });
    return;
  }

  const mode = interaction.options.get('mode')?.value as string;

  const modeMap: Record<string, LoopMode> = {
    none: LoopMode.NONE,
    track: LoopMode.TRACK,
    queue: LoopMode.QUEUE,
  };

  setLoop(interaction.guild.id, modeMap[mode]);
  await saveQueueToDb(interaction.guild.id);

  const labels: Record<string, string> = {
    none: 'Désactivé',
    track: 'Répéter la musique',
    queue: 'Répéter la file',
  };

  await interaction.reply({ embeds: [successEmbed('Mode de répétition', `Le mode de répétition est maintenant : **${labels[mode]}**.`)] });
}
