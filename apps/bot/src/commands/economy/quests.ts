import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { ensureUser } from '../../services/user';
import { getEconomySettings } from '../../services/economy';
import { getActiveQuests, generateDailyQuests, generateWeeklyQuests } from '../../services/quests';
import { enrichedErrorEmbed, createEmbed } from '../../services/embed';
import { isEconomyActive } from '../../services/economy';

export const data = new SlashCommandBuilder()
  .setName('quests')
  .setDescription('Voir vos quêtes actives et votre progression');

export const module = 'economy';

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();
  if (!interaction.guild) return;

  const active = await isEconomyActive(interaction.guild.id);
  if (!active) {
    await interaction.editReply({ 
      embeds: [enrichedErrorEmbed(
        'Module désactivé',
        'Le module économie est désactivé sur ce serveur.',
        'Activez-le via le dashboard ou contactez un administrateur.'
      )] 
    });
    return;
  }

  try {
    await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
    
    await generateDailyQuests(interaction.guild.id);
    await generateWeeklyQuests(interaction.guild.id);

    const quests = await getActiveQuests(interaction.guild.id, interaction.user.id);
    const settings = await getEconomySettings(interaction.guild.id);

    if (quests.length === 0) {
      const embed = createEmbed('economy')
        .setTitle('📋 Quêtes')
        .setDescription('Aucune quête disponible pour le moment.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const dailyQuests = quests.filter((q) => q.type === 'DAILY');
    const weeklyQuests = quests.filter((q) => q.type === 'WEEKLY');

    const formatQuest = (quest: any) => {
      const progress = quest.userProgress?.progress ?? 0;
      const status = quest.userProgress?.status ?? 'ACTIVE';
      const isCompleted = status === 'COMPLETED';
      const progressBar = '█'.repeat(Math.floor((progress / quest.objectiveTarget) * 10)) + 
                         '░'.repeat(10 - Math.floor((progress / quest.objectiveTarget) * 10));
      
      return {
        name: `${isCompleted ? '✅' : '🔲'} ${quest.title}`,
        value: `${quest.description}\n\`[${progressBar}]\` ${progress}/${quest.objectiveTarget}\n💰 Récompense: **${quest.reward} ${settings.currencySymbol}**`,
        inline: false,
      };
    };

    const embed = createEmbed('economy')
      .setTitle('📋 Vos quêtes')
      .setThumbnail(interaction.user.displayAvatarURL());

    if (dailyQuests.length > 0) {
      embed.addFields({ name: '🌅 Quêtes journalières', value: '\u200B' });
      dailyQuests.forEach((quest) => embed.addFields(formatQuest(quest)));
    }

    if (weeklyQuests.length > 0) {
      embed.addFields({ name: '📅 Quêtes hebdomadaires', value: '\u200B' });
      weeklyQuests.forEach((quest) => embed.addFields(formatQuest(quest)));
    }

    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Erreur lors de la récupération des quêtes', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ 
      embeds: [enrichedErrorEmbed(
        'Erreur de récupération',
        'Impossible de récupérer vos quêtes. Veuillez réessayer.',
        'Contactez un administrateur si le problème persiste.'
      )] 
    });
  }
}
