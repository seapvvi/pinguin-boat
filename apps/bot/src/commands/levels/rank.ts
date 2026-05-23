import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { infoEmbed, errorEmbed, createEmbed } from '../../services/embed';
import { calculateLevel, calculateXpForNextLevel } from '../../services/xp';

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('Voir votre niveau et XP ou celui d\'un autre membre')
  .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur à consulter'));

export const module = 'levels';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const targetUser = interaction.options.get('user')?.user ?? interaction.user;

  if (!interaction.guild) return;

  try {
    await ensureUser(targetUser.id, targetUser.username, targetUser.displayAvatarURL());

    let profile = await prisma.xPProfile.findUnique({
      where: { guildId_userId: { guildId: interaction.guild.id, userId: targetUser.id } },
    });

    if (!profile) {
      profile = await prisma.xPProfile.create({
        data: {
          guildId: interaction.guild.id,
          userId: targetUser.id,
          xp: 0,
          level: 0,
          voiceXp: 0,
          messageCount: 0,
          voiceMinutes: 0,
        },
      });
    }

    const allProfiles = await prisma.xPProfile.findMany({
      where: { guildId: interaction.guild.id },
      orderBy: { xp: 'desc' },
    });
    const rank = allProfiles.findIndex((p) => p.userId === targetUser.id) + 1;

    const currentLevel = profile.level;
    const xpForNext = calculateXpForNextLevel(profile.xp);
    const progress = Math.min((profile.xp / xpForNext) * 100, 100);

    const embed = createEmbed('level')
      .setTitle(`📊 ${targetUser.username} - Niveau ${currentLevel}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: 'XP', value: `${profile.xp} / ${xpForNext}`, inline: true },
        { name: 'Rang', value: `#${rank}`, inline: true },
        { name: 'Messages', value: `${profile.messageCount}`, inline: true },
        { name: 'XP vocal', value: `${profile.voiceXp}`, inline: true },
        { name: 'Minutes vocales', value: `${profile.voiceMinutes}`, inline: true },
        { name: 'Progression', value: `${progress.toFixed(1)}%`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de récupérer le profil XP.')] });
  }
}
