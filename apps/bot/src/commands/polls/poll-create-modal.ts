import { ModalSubmitInteraction, Client, MessageFlags } from 'discord.js';
import { prisma } from '@pinguin/db';
import { createEmbed, errorEmbed, successEmbed } from '../../services/embed';
import { log } from '../../services/logger';

const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

export async function handlePollCreateModal(interaction: ModalSubmitInteraction, _client: Client): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild || !interaction.channel?.isTextBased() || !interaction.channelId) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Salon textuel requis.')] });
    return;
  }

  const question = interaction.fields.getTextInputValue('poll_question');
  const optionsRaw = interaction.fields.getTextInputValue('poll_options');
  const anonymousRaw = interaction.fields.getTextInputValue('poll_anonymous');
  const multiRaw = interaction.fields.getTextInputValue('poll_multi');
  const durationRaw = interaction.fields.getTextInputValue('poll_duration');

  const options = optionsRaw.split('\n').map((s) => s.trim()).filter(Boolean);
  if (options.length < 2) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous devez fournir au moins 2 options.')] });
    return;
  }
  if (options.length > 9) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Maximum 9 options autorisées.')] });
    return;
  }

  const anonymous = anonymousRaw?.toLowerCase() === 'oui' || anonymousRaw?.toLowerCase() === 'yes' || anonymousRaw?.toLowerCase() === 'o';
  const multiChoice = multiRaw?.toLowerCase() === 'oui' || multiRaw?.toLowerCase() === 'yes' || multiRaw?.toLowerCase() === 'o';

  let endsAt: Date | null = null;
  if (durationRaw && durationRaw.trim()) {
    const minutes = parseInt(durationRaw, 10);
    if (!isNaN(minutes) && minutes > 0) {
      endsAt = new Date(Date.now() + minutes * 60 * 1000);
    }
  }

  const embed = createEmbed('poll')
    .setTitle('📊 ' + question)
    .setDescription(options.map((opt, i) => `${numberEmojis[i]} ${opt}`).join('\n\n'))
    .setFooter({
      text: [
        `Réagissez pour voter !`,
        anonymous ? '👤 Anonyme' : '',
        multiChoice ? '☑️ Choix multiples' : '',
        endsAt ? `Ferme <t:${Math.floor(endsAt.getTime() / 1000)}:R>` : '',
      ].filter(Boolean).join(' · '),
    })
    .setTimestamp();

  const channel = interaction.channel;
  const pollMessage = await (channel as any).send({ embeds: [embed] });

  for (let i = 0; i < options.length; i++) {
    await pollMessage.react(numberEmojis[i]);
  }

  await prisma.poll.create({
    data: {
      guildId: interaction.guild.id,
      channelId: interaction.channelId,
      messageId: pollMessage.id,
      question,
      options: JSON.stringify(options.map((o, i) => ({ id: String(i), label: o, votes: 0 }))),
      status: 'OPEN',
      anonymous,
      multiChoice,
      endsAt,
    },
  });

  await interaction.editReply({ embeds: [successEmbed('Sondage créé', `Le sondage a été publié dans <#${interaction.channelId}> avec les réactions numérotées.`)] });

  log({ level: 'info', message: `Sondage créé: ${question}`, guildId: interaction.guild.id });
}
