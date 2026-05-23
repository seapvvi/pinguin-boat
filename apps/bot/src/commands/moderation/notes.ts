import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';
import { infoEmbed, errorEmbed, successEmbed } from '../../services/embed';
import { createEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('notes')
  .setDescription('Gérer les notes staff sur un utilisateur')
  .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur').setRequired(true))
  .addStringOption((opt) =>
    opt.setName('action')
      .setDescription('Action')
      .addChoices(
        { name: 'Voir les notes', value: 'view' },
        { name: 'Ajouter une note', value: 'add' },
        { name: 'Supprimer une note', value: 'remove' }
      )
      .setRequired(true)
  )
  .addStringOption((opt) => opt.setName('note').setDescription('Contenu de la note (pour ajouter)'))
  .addStringOption((opt) => opt.setName('note_id').setDescription('ID de la note (pour supprimer)'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const user = interaction.options.get('user')?.user!;
  const action = interaction.options.get('action')?.value as string;
  const noteContent = interaction.options.get('note')?.value as string | undefined;
  const noteId = interaction.options.get('note_id')?.value as string | undefined;

  if (!interaction.guild) return;

  switch (action) {
    case 'view': {
      const notes = await prisma.moderationCase.findMany({
        where: { guildId: interaction.guild.id, userId: user.id, type: 'WARN' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      const embed = createEmbed('info')
        .setTitle(`Notes staff - ${user.tag}`)
        .setDescription(notes.length === 0 ? 'Aucune note.' : `${notes.length} note(s)`)
        .setTimestamp();
      for (const n of notes) {
        embed.addFields({
          name: `${n.createdAt.toLocaleDateString('fr-FR')} - par <@${n.moderatorId}>`,
          value: n.reason.substring(0, 200),
        });
      }
      await interaction.editReply({ embeds: [embed] });
      break;
    }
    case 'add': {
      if (!noteContent) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous devez fournir une note.')] });
        return;
      }
      await prisma.moderationCase.create({
        data: {
          guildId: interaction.guild.id,
          userId: user.id,
          moderatorId: interaction.user.id,
          type: 'WARN',
          reason: `[NOTE STAFF] ${noteContent}`,
          active: false,
        },
      });
      await interaction.editReply({ embeds: [successEmbed('Note ajoutée', `Note ajoutée pour **${user.tag}**.`)] });
      break;
    }
    case 'remove': {
      if (!noteId) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous devez fournir un ID de note.')] });
        return;
      }
      const note = await prisma.moderationCase.findUnique({ where: { id: noteId } });
      if (!note || note.guildId !== interaction.guild.id) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Note introuvable.')] });
        return;
      }
      await prisma.moderationCase.delete({ where: { id: noteId } });
      await interaction.editReply({ embeds: [successEmbed('Note supprimée', `Note ${noteId} supprimée.`)] });
      break;
    }
  }
}
