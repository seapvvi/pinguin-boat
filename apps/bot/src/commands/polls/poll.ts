import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { prisma } from '@pinguin/db';
import { createEmbed, errorEmbed, successEmbed } from '../../services/embed';
import { log } from '../../services/logger';

export const data = new SlashCommandBuilder()
  .setName('poll')
  .setDescription('Créer un sondage avec réactions')
  .addStringOption((opt) => opt.setName('question').setDescription('Question du sondage').setRequired(true))
  .addStringOption((opt) => opt.setName('option1').setDescription('Option 1').setRequired(true))
  .addStringOption((opt) => opt.setName('option2').setDescription('Option 2').setRequired(true))
  .addStringOption((opt) => opt.setName('option3').setDescription('Option 3'))
  .addStringOption((opt) => opt.setName('option4').setDescription('Option 4'))
  .addStringOption((opt) => opt.setName('option5').setDescription('Option 5'))
  .addStringOption((opt) => opt.setName('option6').setDescription('Option 6'))
  .addStringOption((opt) => opt.setName('option7').setDescription('Option 7'))
  .addStringOption((opt) => opt.setName('option8').setDescription('Option 8'))
  .addStringOption((opt) => opt.setName('option9').setDescription('Option 9'))
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export const module = 'polls';

const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const question = interaction.options.get('question')?.value as string;
  const options: string[] = [];

  for (let i = 1; i <= 9; i++) {
    const opt = interaction.options.get(`option${i}`)?.value as string | undefined;
    if (opt) options.push(opt);
  }

  if (options.length < 2) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous devez fournir au moins 2 options.')] });
    return;
  }

  if (!interaction.guild) return;

  const embed = createEmbed('poll')
    .setTitle('📊 ' + question)
    .setDescription(options.map((opt, i) => `${numberEmojis[i]} ${opt}`).join('\n\n'))
    .setFooter({ text: 'Réagissez avec l\'emoji correspondant pour voter !' })
    .setTimestamp();

  const msg = await interaction.editReply({ embeds: [embed] });

  for (let i = 0; i < options.length; i++) {
    await msg.react(numberEmojis[i]);
  }

  await prisma.poll.create({
    data: {
      guildId: interaction.guild.id,
      channelId: interaction.channelId,
      messageId: msg.id,
      question,
      options: JSON.stringify(options),
      status: 'OPEN',
    },
  });

  log({ level: 'info', message: `Sondage créé: ${question}`, guildId: interaction.guild.id });
}
