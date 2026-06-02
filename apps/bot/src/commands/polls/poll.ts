import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { prisma } from '@pinguin/db';
import { createEmbed, errorEmbed, successEmbed, infoEmbed } from '../../services/embed';
import { log } from '../../services/logger';

export const data = new SlashCommandBuilder()
  .setName('poll')
  .setDescription('Gestion des sondages')
  .addSubcommand((sub) =>
    sub.setName('create').setDescription('Créer un nouveau sondage (via formulaire)')
  )
  .addSubcommand((sub) =>
    sub
      .setName('vote')
      .setDescription('Voter à un sondage')
      .addStringOption((opt) =>
        opt.setName('id').setDescription('ID du sondage').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('options').setDescription('Numéros des options (ex: 1,3,5)').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('results')
      .setDescription('Afficher les résultats d\'un sondage')
      .addStringOption((opt) =>
        opt.setName('id').setDescription('ID du sondage').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('close')
      .setDescription('Fermer un sondage')
      .addStringOption((opt) =>
        opt.setName('id').setDescription('ID du sondage').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('Lister les sondages actifs')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export const module = 'polls';
export const cooldown = 5;

const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

function buildBar(value: number, max: number, width = 15): string {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === 'create') {
    await handleCreate(interaction);
  } else if (sub === 'vote') {
    await handleVote(interaction);
  } else if (sub === 'results') {
    await handleResults(interaction);
  } else if (sub === 'close') {
    await handleClose(interaction);
  } else if (sub === 'list') {
    await handleList(interaction);
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('poll_create')
    .setTitle('Créer un sondage');

  const questionInput = new TextInputBuilder()
    .setCustomId('poll_question')
    .setLabel('Question')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Que voulez-vous demander ?')
    .setMaxLength(256)
    .setRequired(true);

  const optionsInput = new TextInputBuilder()
    .setCustomId('poll_options')
    .setLabel('Options (une par ligne, min 2, max 9)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Option 1\nOption 2\nOption 3')
    .setRequired(true);

  const anonymousInput = new TextInputBuilder()
    .setCustomId('poll_anonymous')
    .setLabel('Anonyme ? (oui/non)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('non')
    .setMaxLength(3)
    .setRequired(false);

  const multiInput = new TextInputBuilder()
    .setCustomId('poll_multi')
    .setLabel('Choix multiples ? (oui/non)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('non')
    .setMaxLength(3)
    .setRequired(false);

  const durationInput = new TextInputBuilder()
    .setCustomId('poll_duration')
    .setLabel('Durée (en minutes, 0 = illimité)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('60')
    .setMaxLength(5)
    .setRequired(false);

  const row1 = new ActionRowBuilder<any>().addComponents(questionInput);
  const row2 = new ActionRowBuilder<any>().addComponents(optionsInput);
  const row3 = new ActionRowBuilder<any>().addComponents(anonymousInput);
  const row4 = new ActionRowBuilder<any>().addComponents(multiInput);
  const row5 = new ActionRowBuilder<any>().addComponents(durationInput);
  modal.addComponents(row1, row2, row3, row4, row5);

  await interaction.showModal(modal);
}

async function handleVote(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const pollId = interaction.options.getString('id', true);
  const optionsStr = interaction.options.getString('options', true);

  const poll = await prisma.poll.findFirst({
    where: { id: pollId, guildId: interaction.guildId!, status: 'OPEN' },
  });

  if (!poll) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Sondage introuvable ou déjà fermé.')] });
    return;
  }

  const parsedOptions: { id: string; label: string; votes: number }[] = JSON.parse(poll.options);
  const selectedIndices = optionsStr.split(',').map((s) => parseInt(s.trim(), 10) - 1).filter((n) => !isNaN(n) && n >= 0 && n < parsedOptions.length);

  if (selectedIndices.length === 0) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Numéros d\'options invalides.')] });
    return;
  }

  if (!poll.multiChoice && selectedIndices.length > 1) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Ce sondage n\'autorise pas les choix multiples.')] });
    return;
  }

  if (poll.anonymous) {
    for (const idx of selectedIndices) {
      await prisma.pollVote.create({
        data: { pollId: poll.id, optionIndex: idx },
      });
    }
  } else {
    const dbUser = await prisma.user.findUnique({ where: { discordId: interaction.user.id } });
    if (!dbUser) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Utilisateur introuvable.')] });
      return;
    }

    if (!poll.multiChoice) {
      await prisma.pollVote.deleteMany({ where: { pollId: poll.id, userId: dbUser.id } });
    }

    for (const idx of selectedIndices) {
      const existing = await prisma.pollVote.findFirst({
        where: { pollId: poll.id, userId: dbUser.id, optionIndex: idx },
      });
      if (!existing) {
        await prisma.pollVote.create({
          data: { pollId: poll.id, userId: dbUser.id, optionIndex: idx },
        });
      }
    }
  }

  await interaction.editReply({
    embeds: [successEmbed('Vote enregistré', `Votre vote pour **${poll.question}** a été pris en compte.`)],
  });
}

async function handleResults(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const pollId = interaction.options.getString('id', true);

  const poll = await prisma.poll.findFirst({
    where: { id: pollId, guildId: interaction.guildId! },
    include: { votes: true },
  });

  if (!poll) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Sondage introuvable.')] });
    return;
  }

  const options: { id: string; label: string; votes: number }[] = JSON.parse(poll.options);
  const voteCounts = new Array(options.length).fill(0);

  for (const v of poll.votes) {
    voteCounts[v.optionIndex] = (voteCounts[v.optionIndex] || 0) + 1;
  }

  const maxVotes = Math.max(...voteCounts, 1);
  const totalVotes = voteCounts.reduce((a, b) => a + b, 0);

  const statusLabel = poll.status === 'OPEN' ? '📊 En cours' : '🔒 Terminé';
  const anonymityLabel = poll.anonymous ? 'Anonymous' : 'Public';
  const multiLabel = poll.multiChoice ? 'Choix multiples' : 'Choix unique';

  const descriptionLines = options.map((opt, i) => {
    const bar = buildBar(voteCounts[i], maxVotes);
    const pct = totalVotes > 0 ? ((voteCounts[i] / totalVotes) * 100).toFixed(1) : '0.0';
    return `**${i + 1}.** ${opt.label}\n\`${bar}\` **${voteCounts[i]}** (${pct}%)`;
  });

  const embed = createEmbed('poll')
    .setTitle(`📊 ${poll.question}`)
    .setDescription(descriptionLines.join('\n\n'))
    .addFields(
      { name: 'Statut', value: statusLabel, inline: true },
      { name: 'Total votes', value: String(totalVotes), inline: true },
      { name: 'Type', value: `${anonymityLabel} · ${multiLabel}`, inline: true },
    );

  if (poll.endsAt) {
    embed.addFields({
      name: 'Ferme le',
      value: `<t:${Math.floor(new Date(poll.endsAt).getTime() / 1000)}:R>`,
      inline: true,
    });
  }

  embed.setFooter({ text: `ID: ${poll.id}` });

  await interaction.editReply({ embeds: [embed] });
}

async function handleClose(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const pollId = interaction.options.getString('id', true);

  const poll = await prisma.poll.findFirst({
    where: { id: pollId, guildId: interaction.guildId!, status: 'OPEN' },
    include: { votes: true },
  });

  if (!poll) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Sondage introuvable ou déjà fermé.')] });
    return;
  }

  await prisma.poll.update({ where: { id: poll.id }, data: { status: 'CLOSED' } });

  const options: { id: string; label: string; votes: number }[] = JSON.parse(poll.options);
  const voteCounts = new Array(options.length).fill(0);
  for (const v of poll.votes) {
    voteCounts[v.optionIndex] = (voteCounts[v.optionIndex] || 0) + 1;
  }

  const descLines = options.map((opt, i) => `${numberEmojis[i] || `${i + 1}.`} ${opt.label} — **${voteCounts[i]}** vote(s)`).join('\n');

  if (poll.messageId && poll.channelId) {
    try {
      const channel = await interaction.guild?.channels.fetch(poll.channelId);
      if (channel?.isTextBased()) {
        const msg = await channel.messages.fetch(poll.messageId).catch(() => null);
        if (msg) {
          const embed = createEmbed('poll')
            .setTitle(`📊 ${poll.question} (Terminé)`)
            .setDescription(descLines)
            .setFooter({ text: 'Sondage fermé' });
          await msg.edit({ embeds: [embed] });
        }
      }
    } catch { /* ignore */ }
  }

  await interaction.editReply({ embeds: [successEmbed('Sondage fermé', `Le sondage **${poll.question}** a été fermé.`)] });
}

async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const polls = await prisma.poll.findMany({
    where: { guildId: interaction.guildId!, status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
    take: 25,
    include: { votes: true },
  });

  if (polls.length === 0) {
    await interaction.editReply({ embeds: [infoEmbed('Sondages', 'Aucun sondage actif sur ce serveur.')] });
    return;
  }

  const description = polls.map((p) => {
    const total = p.votes.length;
    const ends = p.endsAt ? ` — fin <t:${Math.floor(new Date(p.endsAt).getTime() / 1000)}:R>` : '';
    const badges = [p.anonymous ? '👤 Anonyme' : '', p.multiChoice ? '☑️ Multi' : ''].filter(Boolean).join(' ');
    return `**${p.question}**\n┃ 🆔 \`${p.id}\` • ${total} vote(s)${ends}\n┃ ${badges}`;
  }).join('\n\n');

  const embed = createEmbed('poll')
    .setTitle(`📊 Sondages actifs (${polls.length})`)
    .setDescription(description);

  await interaction.editReply({ embeds: [embed] });
}
