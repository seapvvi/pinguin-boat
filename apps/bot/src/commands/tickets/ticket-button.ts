import { ButtonInteraction, Client, TextChannel, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { errorEmbed, successEmbed, createEmbed } from '../../services/embed';
import { closeTicketViaApi } from '../../services/ticket-close';
type DiscordErrorLike = {
  code?: number;
  status?: number;
  method?: string;
  path?: string;
  url?: string;
  message?: string;
  rawError?: { code?: number; message?: string };
};

class TicketChannelCreationError extends Error {
  constructor(
    public readonly primaryError: unknown,
    public readonly fallbackError?: unknown,
  ) {
    super('Impossible de créer le salon ticket.');
    this.name = 'TicketChannelCreationError';
  }
}

function parseRoleIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v)).filter(Boolean);
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function sanitizeTicketChannelName(format: string | null | undefined, username: string): string {
  const safeUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32) || 'user';
  const base = (format ?? 'ticket-{username}')
    .replace('{username}', safeUsername)
    .toLowerCase();
  const normalized = base
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return normalized || `ticket-${safeUsername}`.slice(0, 90);
}

function getDiscordErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const err = error as DiscordErrorLike;
  if (typeof err.code === 'number') return err.code;
  if (typeof err.rawError?.code === 'number') return err.rawError.code;
  return undefined;
}

function getDiscordErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const err = error as DiscordErrorLike;
    if (typeof err.rawError?.message === 'string' && err.rawError.message.trim()) return err.rawError.message;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Erreur Discord inconnue.';
}

function getDiscordErrorHint(code?: number): string {
  switch (code) {
    case 50013:
      return 'Permissions manquantes pour créer le salon (Gérer les salons / Voir les salons / permissions de catégorie).';
    case 50001:
      return 'Accès Discord refusé (le bot n’a pas accès au serveur, salon parent ou catégorie).';
    case 10003:
      return 'La catégorie configurée est introuvable sur Discord.';
    case 30013:
      return 'Limite de salons Discord atteinte sur ce serveur.';
    case 50035:
      return 'Paramètres de création invalides (nom du salon, parent ou overwrites).';
    default:
      return 'Discord a refusé la création du salon ticket.';
  }
}

function formatSingleDiscordError(error: unknown): string {
  const code = getDiscordErrorCode(error);
  const message = getDiscordErrorMessage(error);
  const hint = getDiscordErrorHint(code);
  const err = (error && typeof error === 'object') ? (error as DiscordErrorLike) : undefined;
  const technical = [
    typeof code === 'number' ? `code ${code}` : null,
    typeof err?.status === 'number' ? `HTTP ${err.status}` : null,
    typeof err?.method === 'string' ? err.method : null,
    typeof err?.path === 'string' ? err.path : null,
  ].filter((v): v is string => Boolean(v)).join(' • ');

  return [
    hint,
    `Discord: ${message}`,
    technical ? `Détails techniques: \`${technical}\`` : null,
  ].filter((v): v is string => Boolean(v)).join('\n');
}

function formatTicketCreationError(error: unknown): string {
  if (error instanceof TicketChannelCreationError && error.fallbackError) {
    return [
      'Création du ticket échouée après tentative avec et sans catégorie.',
      `• Avec catégorie: ${formatSingleDiscordError(error.primaryError)}`,
      `• Sans catégorie: ${formatSingleDiscordError(error.fallbackError)}`,
    ].join('\n');
  }
  if (error instanceof TicketChannelCreationError) {
    return formatSingleDiscordError(error.primaryError);
  }
  return formatSingleDiscordError(error);
}

function shouldRetryWithoutCategory(error: unknown): boolean {
  const code = getDiscordErrorCode(error);
  return code === 50013 || code === 50001 || code === 10003;
}

async function createTicketChannel(
  interaction: ButtonInteraction,
  channelName: string,
  categoryId: string | undefined,
  permissionOverwrites: any[],
): Promise<{ channel: TextChannel; usedFallback: boolean }> {
  if (!interaction.guild) {
    throw new Error('Serveur Discord introuvable.');
  }

  const reason = `Ticket ouvert par ${interaction.user.tag}`;

  if (!categoryId) {
    const channel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites,
      reason,
    });
    return { channel: channel as TextChannel, usedFallback: false };
  }

  try {
    const channel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites,
      reason,
    });
    return { channel: channel as TextChannel, usedFallback: false };
  } catch (primaryError) {
    if (!shouldRetryWithoutCategory(primaryError)) {
      throw new TicketChannelCreationError(primaryError);
    }

    try {
      const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites,
        reason: `${reason} (fallback sans catégorie)`,
      });
      return { channel: channel as TextChannel, usedFallback: true };
    } catch (fallbackError) {
      throw new TicketChannelCreationError(primaryError, fallbackError);
    }
  }
}

export async function handleTicketButton(interaction: ButtonInteraction, client: Client): Promise<void> {
  const { customId, guild } = interaction;
  if (!guild) return;

  if (customId === 'ticket_open') {
    await handleTicketOpen(interaction, client);
    return;
  }

  if (customId === 'ticket_close') {
    await handleTicketClose(interaction);
    return;
  }

  if (customId === 'ticket_claim') {
    await handleTicketClaim(interaction);
    return;
  }
}

async function handleTicketOpen(interaction: ButtonInteraction, client: Client): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const [existing, ticketSettings, legacyCategory] = await Promise.all([
      prisma.ticket.findMany({
        where: { guildId: interaction.guildId!, creatorId: interaction.user.id, status: { in: ['OPEN', 'CLAIMED', 'PENDING'] } },
      }),
      prisma.ticketSettings.findUnique({ where: { guildId: interaction.guildId! } }),
      prisma.ticketCategory.findFirst({ where: { guildId: interaction.guildId! }, orderBy: { createdAt: 'asc' } }),
    ]);
    const maxTickets =
      (typeof ticketSettings?.maxOpenPerUser === 'number' && ticketSettings.maxOpenPerUser > 0)
        ? ticketSettings.maxOpenPerUser
        : (legacyCategory?.maxTicketsPerUser ?? 5);

    if (existing.length >= maxTickets) {
      await interaction.editReply({ embeds: [errorEmbed('Limite atteinte', `Tu as déjà **${existing.length}** ticket(s) ouverts.`)] });
      return;
    }

    await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
    const categoryId = ticketSettings?.categoryId ?? undefined;
    const channelName = sanitizeTicketChannelName(ticketSettings?.channelFormat, interaction.user.username);
    const modRoles = parseRoleIds(ticketSettings?.moderatorRoles);
    const permissionOverwrites: any[] = [
      { id: interaction.guild!.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
    ];
    for (const roleId of modRoles) {
      permissionOverwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
    }

    const { channel: ticketChannel, usedFallback } = await createTicketChannel(interaction, channelName, categoryId, permissionOverwrites);

    await prisma.ticket.create({
      data: {
        guildId: interaction.guildId!,
        channelId: ticketChannel.id,
        creatorId: interaction.user.id,
        subject: 'Support',
        status: 'OPEN',
      },
    });

    const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket_close').setLabel('Fermer').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
      new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('🤚'),
    );

    const ticketEmbed = createEmbed('ticket')
      .setTitle('Ticket — Support')
      .setDescription(ticketSettings?.openMessage ?? 'Un membre de l\'équipe va te répondre sous peu.')
      .addFields(
        { name: 'Ouvert par', value: interaction.user.toString(), inline: true },
        { name: 'Statut', value: '🟢 Ouvert', inline: true },
      )
      .setTimestamp();

    const mentionContent = ticketSettings?.mentionModerators && modRoles.length > 0
      ? [interaction.user.toString(), ...modRoles.map((r) => `<@&${r}>`)].join(' ')
      : interaction.user.toString();

    await ticketChannel.send({ content: mentionContent, embeds: [ticketEmbed], components: [closeRow] });
    await interaction.editReply({
      embeds: [
        successEmbed(
          'Ticket ouvert',
          usedFallback
            ? `Ton ticket a été créé : ${ticketChannel}\n⚠️ La catégorie configurée était inaccessible, le ticket a été créé hors catégorie.`
            : `Ton ticket a été créé : ${ticketChannel}`,
        ),
      ],
    });
  } catch (error) {
    console.error('[TICKET OPEN ERROR]', error);
    await interaction.editReply({
      embeds: [errorEmbed('Erreur Discord', formatTicketCreationError(error))],
    }).catch(() => {});
  }
}

async function handleTicketClose(interaction: ButtonInteraction): Promise<void> {
  const ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channelId } });
  if (!ticket || ticket.guildId !== interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Ce salon n\'est pas un ticket.')], ephemeral: true });
    return;
  }

  if (ticket.status === 'CLOSED') {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Ce ticket est déjà fermé.')], ephemeral: true });
    return;
  }

  if (ticket.creatorId !== interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ embeds: [errorEmbed('Permission refusée', 'Seul le créateur ou un admin peut fermer.')], ephemeral: true });
    return;
  }

  const ch = interaction.channel as TextChannel;
  try {
    const member = await interaction.guild!.members.fetch(ticket.creatorId);
    await ch.permissionOverwrites.edit(member, { ViewChannel: false });
  } catch {}

  await interaction.reply({ embeds: [successEmbed('Fermé', 'Ticket fermé. Transcription en cours…')] });

  await closeTicketViaApi(ticket.id, interaction.user.id, interaction.guild!.name);

  setTimeout(async () => {
    try {
      await ch.delete('Ticket fermé');
      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'DELETED' } });
    } catch {}
  }, 30000);
}

async function handleTicketClaim(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
    await interaction.reply({ embeds: [errorEmbed('Permission refusée', 'Permissions de modération requises.')], ephemeral: true });
    return;
  }

  const ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channelId } });
  if (!ticket || ticket.guildId !== interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Ce salon n\'est pas un ticket.')], ephemeral: true });
    return;
  }

  if (ticket.claimedById) {
    await interaction.reply({ embeds: [errorEmbed('Déjà claim', `Par <@${ticket.claimedById}>.`)], ephemeral: true });
    return;
  }

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: 'CLAIMED', claimedById: interaction.user.id },
  });

  await (interaction.channel as TextChannel)?.setName(`claimed-${ticket.subject.slice(0, 24).toLowerCase().replace(/[^a-z0-9]/g, '-')}`).catch(() => {});
  await interaction.reply({ embeds: [successEmbed('Claim', `Ticket claim par ${interaction.user}.`)] });
}
