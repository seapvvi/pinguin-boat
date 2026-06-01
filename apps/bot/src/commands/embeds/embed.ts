import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, TextChannel, ChannelType } from 'discord.js';
import { prisma } from '@pinguin/db';
import { infoEmbed, errorEmbed, successEmbed, createEmbed } from '../../services/embed';
import { log } from '../../services/logger';

export const data = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('Gérer les embeds personnalisés')
  .addSubcommand((sub) =>
    sub.setName('create')
      .setDescription('Créer un embed personnalisé')
      .addStringOption((opt) => opt.setName('name').setDescription('Nom de l\'embed').setRequired(true))
      .addStringOption((opt) => opt.setName('title').setDescription('Titre de l\'embed'))
      .addStringOption((opt) => opt.setName('description').setDescription('Description de l\'embed'))
      .addStringOption((opt) => opt.setName('color').setDescription('Couleur hexadécimale (ex: #e0e0e0)'))
  )
  .addSubcommand((sub) =>
    sub.setName('send')
      .setDescription('Envoyer un embed personnalisé')
      .addStringOption((opt) => opt.setName('name').setDescription('Nom de l\'embed').setRequired(true).setAutocomplete(true))
      .addChannelOption((opt) =>
        opt.setName('channel').setDescription('Salon de destination').addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('list')
      .setDescription('Lister les embeds personnalisés')
  )
  .addSubcommand((sub) =>
    sub.setName('edit')
      .setDescription('Modifier un embed personnalisé')
      .addStringOption((opt) => opt.setName('name').setDescription('Nom de l\'embed').setRequired(true))
      .addStringOption((opt) => opt.setName('title').setDescription('Nouveau titre'))
      .addStringOption((opt) => opt.setName('description').setDescription('Nouvelle description'))
      .addStringOption((opt) => opt.setName('color').setDescription('Nouvelle couleur'))
  )
  .addSubcommand((sub) =>
    sub.setName('delete')
      .setDescription('Supprimer un embed personnalisé')
      .addStringOption((opt) => opt.setName('name').setDescription('Nom de l\'embed').setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export const permissions = true;
export const module = 'embeds';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (!interaction.guild) return;

  switch (subcommand) {
    case 'create': {
      await interaction.deferReply();

      const name = interaction.options.get('name')?.value as string;
      const title = interaction.options.get('title')?.value as string | undefined;
      const description = interaction.options.get('description')?.value as string | undefined;
      const color = interaction.options.get('color')?.value as string | undefined;

      const existing = await prisma.savedEmbed.findFirst({
        where: { guildId: interaction.guild.id, name },
      });

      if (existing) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Un embed avec ce nom existe déjà.')] });
        return;
      }

      await prisma.savedEmbed.create({
        data: {
          guildId: interaction.guild.id,
          name,
          title: title ?? null,
          description: description ?? null,
          color: color ?? '#e0e0e0',
        },
      });

      await interaction.editReply({ embeds: [successEmbed('Embed créé', `L'embed **${name}** a été créé.`)] });
      break;
    }

    case 'send': {
      await interaction.deferReply();

      const name = interaction.options.get('name')?.value as string;
      const channel = (interaction.options.get('channel')?.channel as TextChannel) ?? interaction.channel;

      const embed = await prisma.savedEmbed.findFirst({
        where: { guildId: interaction.guild.id, name },
      });

      if (!embed) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Embed introuvable.')] });
        return;
      }

      const embedBuilder = createEmbed('default')
        .setTitle(embed.title ?? null)
        .setDescription(embed.description ?? null)
        .setColor((embed.color || '#e0e0e0') as any)
        .setTimestamp(embed.timestamp ? new Date() : undefined);

      if (embed.footer) embedBuilder.setFooter({ text: embed.footer });
      if (embed.image) embedBuilder.setImage(embed.image);
      if (embed.thumbnail) embedBuilder.setThumbnail(embed.thumbnail);

      if (embed.fields) {
        const fields = JSON.parse(embed.fields);
        for (const f of fields) {
          embedBuilder.addFields({ name: f.name, value: f.value, inline: f.inline ?? false });
        }
      }

      await (channel as TextChannel).send({ embeds: [embedBuilder] });
      await interaction.editReply({ embeds: [successEmbed('Embed envoyé', `L'embed **${name}** a été envoyé dans ${channel}.`)] });
      break;
    }

    case 'list': {
      await interaction.deferReply();

      const embeds = await prisma.savedEmbed.findMany({
        where: { guildId: interaction.guild.id },
      });

      if (embeds.length === 0) {
        await interaction.editReply({ embeds: [infoEmbed('Embeds', 'Aucun embed personnalisé.')] });
        return;
      }

      const embedList = createEmbed('default')
        .setTitle('📋 Embeds personnalisés')
        .setDescription(embeds.map((e) => `**${e.name}** — ${e.title || 'Sans titre'}`).join('\n'))
        .setTimestamp();

      await interaction.editReply({ embeds: [embedList] });
      break;
    }

    case 'edit': {
      await interaction.deferReply();

      const name = interaction.options.get('name')?.value as string;
      const title = interaction.options.get('title')?.value as string | undefined;
      const description = interaction.options.get('description')?.value as string | undefined;
      const color = interaction.options.get('color')?.value as string | undefined;

      const existing = await prisma.savedEmbed.findFirst({
        where: { guildId: interaction.guild.id, name },
      });

      if (!existing) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Embed introuvable.')] });
        return;
      }

      const updateData: Record<string, any> = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (color !== undefined) updateData.color = color;

      await prisma.savedEmbed.update({
        where: { id: existing.id },
        data: updateData,
      });

      await interaction.editReply({ embeds: [successEmbed('Embed modifié', `L'embed **${name}** a été modifié.`)] });
      break;
    }

    case 'delete': {
      await interaction.deferReply();

      const name = interaction.options.get('name')?.value as string;

      const existing = await prisma.savedEmbed.findFirst({
        where: { guildId: interaction.guild.id, name },
      });

      if (!existing) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Embed introuvable.')] });
        return;
      }

      await prisma.savedEmbed.delete({ where: { id: existing.id } });

      await interaction.editReply({ embeds: [successEmbed('Embed supprimé', `L'embed **${name}** a été supprimé.`)] });
      break;
    }
  }
}

export async function autocomplete(interaction: any, _client: Client): Promise<void> {
  if (!interaction.guild) return;

  const focusedValue = interaction.options.getFocused();
  const subcommand = interaction.options.getSubcommand();

  if (subcommand !== 'send') return;

  const embeds = await prisma.savedEmbed.findMany({
    where: { guildId: interaction.guild.id },
  });

  const filtered = embeds
    .filter((embed) => embed.name.toLowerCase().includes(focusedValue.toLowerCase()))
    .slice(0, 25);

  await interaction.respond(
    filtered.map((embed) => ({ name: embed.name, value: embed.name }))
  );
}
