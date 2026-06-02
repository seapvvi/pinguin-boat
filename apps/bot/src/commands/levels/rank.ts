import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { errorEmbed } from '../../services/embed';
import { calculateXpForNextLevel } from '../../services/xp';
import { isModuleEnabled } from '../../guards/module';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { logger } from '@pinguin/shared';
import { AttachmentBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('Voir votre niveau et XP ou celui d\'un autre membre')
  .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur à consulter'));

export const module = 'levels';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const targetUser = interaction.options.get('user')?.user ?? interaction.user;

  if (!interaction.guild) return;

  if (!(await isModuleEnabled(interaction.guild.id, 'levels'))) {
    await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'Le module levels est désactivé sur ce serveur.')] });
    return;
  }

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

    const settings = await prisma.xPSettings.findUnique({
      where: { guildId: interaction.guild.id },
    });
    const levelColor = settings?.levelColor || '#14b8a6';

    const image = await generateRankCard(
      targetUser.displayAvatarURL({ size: 256 }),
      targetUser.username,
      currentLevel,
      profile.xp,
      xpForNext,
      rank,
      levelColor
    );

    const attachment = new AttachmentBuilder(image, { name: 'rank.png' });

    await interaction.editReply({ files: [attachment] });
  } catch (error) {
    logger.error('Erreur lors de la récupération du profil XP', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de récupérer le profil XP.')] });
  }
}

async function generateRankCard(
  avatarUrl: string,
  username: string,
  level: number,
  currentXp: number,
  requiredXp: number,
  rank: number,
  levelColor: string
): Promise<Buffer> {
  const width = 800;
  const height = 250;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fond sombre avec dégradé
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Bordure colorée
  ctx.strokeStyle = levelColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, width, height);

  // Chargement et dessin de l'avatar
  const avatar = await loadImage(avatarUrl);
  const avatarSize = 120;
  const avatarX = 30;
  const avatarY = (height - avatarSize) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  ctx.restore();

  // Bordure de l'avatar
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.strokeStyle = levelColor;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Configuration du texte
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Arial';
  ctx.fillText(username, 170, 60);

  // Niveau
  ctx.fillStyle = '#a0a0a0';
  ctx.font = '20px Arial';
  ctx.fillText(`Niveau ${level}`, 170, 95);

  // Rang
  ctx.fillStyle = levelColor;
  ctx.font = 'bold 24px Arial';
  ctx.fillText(`Rang #${rank}`, 170, 130);

  // Barre de progression
  const barX = 170;
  const barY = 150;
  const barWidth = 580;
  const barHeight = 20;

  // Fond de la barre
  ctx.fillStyle = '#2a2a4a';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barWidth, barHeight, 10);
  ctx.fill();

  // Progression
  const progress = Math.min(currentXp / requiredXp, 1);
  const progressWidth = barWidth * progress;

  ctx.fillStyle = levelColor;
  ctx.beginPath();
  ctx.roundRect(barX, barY, progressWidth, barHeight, 10);
  ctx.fill();

  // Texte XP
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px Arial';
  ctx.fillText(`${currentXp} / ${requiredXp} XP`, barX, barY - 10);

  // Pourcentage
  ctx.textAlign = 'right';
  ctx.fillText(`${(progress * 100).toFixed(1)}%`, barX + barWidth, barY - 10);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}
