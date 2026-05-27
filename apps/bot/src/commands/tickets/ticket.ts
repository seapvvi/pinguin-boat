import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, ChannelType, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, CategoryChannel } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { infoEmbed, errorEmbed, successEmbed, createEmbed, warningEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Gérer le système de tickets')
  .addSubcommand((sub) =>
    sub.setName('panel').setDescription('Envoyer le panneau de création de tickets')
  )
  .addSubcommand((sub) =>
    sub.setName('open')
      .setDescription('Ouvrir un ticket')
      .addStringOption((opt) => opt.setName('subject').setDescription('Sujet du ticket').setRequired(true))
      .addStringOption((opt) => opt.setName('category').setDescription('Catégorie du ticket'))
      .addStringOption((opt) => opt.setName('description').setDescription('Description du ticket'))
  )
  .addSubcommand((sub) =>
    sub.setName('close').setDescription('Fermer le ticket actuel')
  )
  .addSubcommand((sub) =>
    sub.setName('claim').setDescription('Claim le ticket actuel')
  )
  .addSubcommand((sub) =>
    sub.setName('unclaim').setDescription('Unclaim le ticket actuel')
  )
  .addSubcommand((sub) =>
    sub.setName('add')
      .setDescription('Ajouter un membre au ticket')
      .addUserOption((opt) => opt.setName('user').setDescription('Membre à ajouter').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName('remove')
      .setDescription('Retirer un membre du ticket')
      .addUserOption((opt) => opt.setName('user').setDescription('Membre à retirer').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName('rename')
      .setDescription('Renommer le ticket')
      .addStringOption((opt) => opt.setName('name').setDescription('Nouveau nom').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName('limit')
      .setDescription('Définir la limite de tickets par utilisateur')
      .addIntegerOption((opt) => opt.setName('max').setDescription('Maximum de tickets').setRequired(true).setMinValue(1).setMaxValue(10))
  );

export const module = 'tickets';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;

  if (!guild) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Cette commande doit être utilisée dans un serveur.')], ephemeral: true });
    return;
  }

  switch (subcommand) {
    case 'panel': {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ embeds: [errorEmbed('Permission refusée', 'Seuls les administrateurs peuvent envoyer le panneau de tickets.')], ephemeral: true });
        return;
      }

      const embed = createEmbed('ticket')
        .setTitle('🎫 Support')
        .setDescription('Cliquez sur le bouton ci-dessous pour ouvrir un ticket de support.\nNotre équipe vous répondra dès que possible.')
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_open')
          .setLabel('Ouvrir un ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫')
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      break;
    }

    case 'open': {
      const subject = interaction.options.get('subject')?.value as string;
      const description = interaction.options.get('description')?.value as string | undefined;
      const category = interaction.options.get('category')?.value as string | undefined;

      const existingTickets = await prisma.ticket.findMany({
        where: { guildId: guild.id, creatorId: interaction.user.id, status: { in: ['OPEN', 'CLAIMED', 'PENDING'] } },
      });

      const categories = await prisma.ticketCategory.findMany({ where: { guildId: guild.id } });
      const maxTickets = categories.length > 0 ? categories[0].maxTicketsPerUser : 5;

      if (existingTickets.length >= maxTickets) {
        await interaction.reply({ embeds: [errorEmbed('Limite atteinte', `Vous avez déjà **${existingTickets.length}** ticket(s) ouverts. Veuillez fermer un ticket existant avant d'en ouvrir un nouveau.`)], ephemeral: true });
        return;
      }

      const botMember = await guild.members.fetch(client.user!.id);
      if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ embeds: [errorEmbed('Permissions manquantes', 'Le bot doit avoir la permission **Gérer les salons** (ou Administrateur) sur ce serveur pour créer des tickets.')], ephemeral: true });
        return;
      }

      await interaction.deferReply();

      await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());

      let ticketChannel: TextChannel;
      let usedFallback = false;

      try {
        if (category) {
          // Try to verify category exists first
        try {
          const categoryChannel = await guild.channels.fetch(category);
          if (!categoryChannel || categoryChannel.type !== ChannelType.GuildCategory) {
            // Category doesn't exist, create without it
            ticketChannel = await guild.channels.create({
              name: `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
              type: ChannelType.GuildText,
              permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
              ],
              reason: `Ticket ouvert par ${interaction.user.tag} (catégorie invalide)`,
            }) as TextChannel;
            usedFallback = true;
          } else {
            // Category exists, try to create with it
            try {
              ticketChannel = await guild.channels.create({
                name: `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                  { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                  { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                  { id: client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
                ],
                reason: `Ticket ouvert par ${interaction.user.tag}`,
              }) as TextChannel;
            } catch (error) {
              // Fallback to no category if permission error
              ticketChannel = await guild.channels.create({
                name: `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                  { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                  { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                  { id: client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
                ],
                reason: `Ticket ouvert par ${interaction.user.tag} (fallback sans catégorie)`,
              }) as TextChannel;
              usedFallback = true;
            }
          }
        } catch (error) {
          // Can't access category, create without it
          ticketChannel = await guild.channels.create({
            name: `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
              { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
              { id: client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
            ],
            reason: `Ticket ouvert par ${interaction.user.tag} (catégorie inaccessible)`,
          }) as TextChannel;
          usedFallback = true;
        }
      } else {
        // No category specified
        ticketChannel = await guild.channels.create({
          name: `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
          ],
          reason: `Ticket ouvert par ${interaction.user.tag}`,
        }) as TextChannel;
        }
      } catch (error) {
        const code = (error as any)?.code ?? (error as any)?.rawError?.code;
        if (code === 50013) {
          await interaction.editReply({ embeds: [errorEmbed('Erreur Discord', 'Permissions manquantes. Le bot doit avoir les permissions **Gérer les salons** et **Gérer les rôles** (ou Administrateur) sur ce serveur.')] });
        } else {
          await interaction.editReply({ embeds: [errorEmbed('Erreur Discord', 'Impossible de créer le salon ticket. Vérifiez que le bot a les permissions nécessaires.')] });
        }
        return;
      }

      const ticket = await prisma.ticket.create({
        data: {
          guildId: guild.id,
          channelId: ticketChannel.id,
          creatorId: interaction.user.id,
          subject,
          description,
          status: 'OPEN',
        },
      });

      if (category && !usedFallback) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { categoryId: category },
        });
      }

      const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Fermer').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('🤚'),
      );

      const ticketEmbed = createEmbed('ticket')
        .setTitle(`Ticket - ${subject}`)
        .setDescription(description || 'Aucune description fournie.')
        .addFields(
          { name: 'Ouvert par', value: interaction.user.toString(), inline: true },
          { name: 'Statut', value: '🟢 Ouvert', inline: true }
        )
        .setTimestamp();

      await ticketChannel.send({ content: interaction.user.toString(), embeds: [ticketEmbed], components: [closeRow] });
      await interaction.editReply({ embeds: [successEmbed('Ticket ouvert', `Votre ticket a été créé : ${ticketChannel}`)] });
      break;
    }

    case 'close': {
      const ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channelId } });
      if (!ticket || ticket.guildId !== guild.id) {
        await interaction.reply({ embeds: [errorEmbed('Erreur', 'Ce salon n\'est pas un ticket.')], ephemeral: true });
        return;
      }

      if (ticket.status === 'CLOSED') {
        await interaction.reply({ embeds: [errorEmbed('Erreur', 'Ce ticket est déjà fermé.')], ephemeral: true });
        return;
      }

      if (ticket.creatorId !== interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ embeds: [errorEmbed('Permission refusée', 'Seul le créateur du ticket ou un administrateur peut fermer ce ticket.')], ephemeral: true });
        return;
      }

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'CLOSED', closedById: interaction.user.id, closedAt: new Date() },
      });

      const channel = interaction.channel as TextChannel;
      try {
        const member = await interaction.guild!.members.fetch(ticket.creatorId);
        await channel.permissionOverwrites.edit(member, { ViewChannel: false });
      } catch {}

      await interaction.reply({ embeds: [successEmbed('Ticket fermé', 'Ce ticket a été fermé.')] });

      setTimeout(async () => {
        try {
          await channel.delete('Ticket fermé');
          await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'DELETED' } });
        } catch {}
      }, 30000);
      break;
    }

    case 'claim': {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ embeds: [errorEmbed('Permission refusée', 'Vous devez avoir les permissions de modération pour claim un ticket.')], ephemeral: true });
        return;
      }

      const ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channelId } });
      if (!ticket || ticket.guildId !== guild.id) {
        await interaction.reply({ embeds: [errorEmbed('Erreur', 'Ce salon n\'est pas un ticket.')], ephemeral: true });
        return;
      }

      if (ticket.claimedById) {
        await interaction.reply({ embeds: [errorEmbed('Déjà claim', `Ce ticket a déjà été claim par <@${ticket.claimedById}>.`)], ephemeral: true });
        return;
      }

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'CLAIMED', claimedById: interaction.user.id },
      });

      await (interaction.channel as TextChannel)?.setName(`claimed-${ticket.subject.slice(0, 24).toLowerCase().replace(/[^a-z0-9]/g, '-')}`).catch(() => {});
      await interaction.reply({ embeds: [successEmbed('Ticket claim', `Ticket claim par ${interaction.user}.`)] });
      break;
    }

    case 'unclaim': {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ embeds: [errorEmbed('Permission refusée', 'Vous devez avoir les permissions de modération pour unclaim un ticket.')], ephemeral: true });
        return;
      }

      const ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channelId } });
      if (!ticket || ticket.guildId !== guild.id) {
        await interaction.reply({ embeds: [errorEmbed('Erreur', 'Ce salon n\'est pas un ticket.')], ephemeral: true });
        return;
      }

      if (ticket.claimedById !== interaction.user.id) {
        await interaction.reply({ embeds: [errorEmbed('Erreur', 'Vous n\'avez pas claim ce ticket.')], ephemeral: true });
        return;
      }

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'OPEN', claimedById: null },
      });

      await (interaction.channel as TextChannel)?.setName(`ticket-${ticket.subject.slice(0, 24).toLowerCase().replace(/[^a-z0-9]/g, '-')}`).catch(() => {});
      await interaction.reply({ embeds: [successEmbed('Ticket unclaim', 'Ce ticket a été unclaim.')] });
      break;
    }

    case 'add': {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ embeds: [errorEmbed('Permission refusée', 'Vous devez avoir les permissions de modération pour ajouter un membre.')], ephemeral: true });
        return;
      }

      const user = interaction.options.get('user')?.user!;
      const channel = interaction.channel as TextChannel;

      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });

      await interaction.reply({ embeds: [successEmbed('Membre ajouté', `${user} a été ajouté au ticket.`)] });
      break;
    }

    case 'remove': {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ embeds: [errorEmbed('Permission refusée', 'Vous devez avoir les permissions de modération pour retirer un membre.')], ephemeral: true });
        return;
      }

      const user = interaction.options.get('user')?.user!;
      const channel = interaction.channel as TextChannel;
      const ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channelId } });

      if (ticket?.creatorId === user.id) {
        await interaction.reply({ embeds: [errorEmbed('Erreur', 'Vous ne pouvez pas retirer le créateur du ticket.')], ephemeral: true });
        return;
      }

      await channel.permissionOverwrites.edit(user.id, { ViewChannel: false });

      await interaction.reply({ embeds: [successEmbed('Membre retiré', `${user} a été retiré du ticket.`)] });
      break;
    }

    case 'rename': {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ embeds: [errorEmbed('Permission refusée', 'Vous devez avoir les permissions de modération pour renommer un ticket.')], ephemeral: true });
        return;
      }

      const name = interaction.options.get('name')?.value as string;
      const channel = interaction.channel as TextChannel;
      await channel.setName(`ticket-${name.toLowerCase().replace(/[^a-z0-9-]/g, '')}`);

      await interaction.reply({ embeds: [successEmbed('Ticket renommé', `Le ticket a été renommé en **${name}**.`)] });
      break;
    }

    case 'limit': {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ embeds: [errorEmbed('Permission refusée', 'Seuls les administrateurs peuvent modifier la limite de tickets.')], ephemeral: true });
        return;
      }

      const max = interaction.options.get('max')?.value as number;
      const categories = await prisma.ticketCategory.findMany({ where: { guildId: guild.id } });

      if (categories.length > 0) {
        await prisma.ticketCategory.update({
          where: { id: categories[0].id },
          data: { maxTicketsPerUser: max },
        });
      } else {
        await prisma.ticketCategory.create({
          data: { guildId: guild.id, name: 'General', maxTicketsPerUser: max },
        });
      }

      await interaction.reply({ embeds: [successEmbed('Limite définie', `La limite de tickets par utilisateur est maintenant de ${max}.`)] });
      break;
    }
  }
}
