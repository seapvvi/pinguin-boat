import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { errorEmbed, successEmbed, createEmbed, infoEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';
import {
  createClan,
  getClanByName,
  getUserClan,
  addMember,
  removeMember,
  deleteClan,
  getClansLeaderboard,
  getClan,
  getClanMembers,
  getClanTotalXp,
  getClanTotalWallet,
  startWar,
  acceptWar,
  completeWar,
  cancelWar,
  getActiveWarForClan,
  getPendingWarForClan,
  WAR_PRIZE_PER_MEMBER,
} from '../../services/clans';

export const data = new SlashCommandBuilder()
  .setName('clan')
  .setDescription('Gestion des clans et équipes')
  .addSubcommand((sub) =>
    sub.setName('create').setDescription('Créer un clan')
      .addStringOption((opt) => opt.setName('nom').setDescription('Nom du clan').setRequired(true).setMaxLength(32))
      .addStringOption((opt) => opt.setName('description').setDescription('Description du clan').setMaxLength(200))
  )
  .addSubcommand((sub) =>
    sub.setName('invite').setDescription('Inviter un membre dans votre clan')
      .addUserOption((opt) => opt.setName('membre').setDescription('Membre à inviter').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName('leave').setDescription('Quitter votre clan')
  )
  .addSubcommand((sub) =>
    sub.setName('delete').setDescription('Supprimer votre clan (propriétaire seulement)')
  )
  .addSubcommand((sub) =>
    sub.setName('info').setDescription('Informations sur un clan')
      .addStringOption((opt) => opt.setName('nom').setDescription('Nom du clan'))
  )
  .addSubcommand((sub) =>
    sub.setName('leaderboard').setDescription('Classement des clans')
      .addStringOption((opt) =>
        opt.setName('type').setDescription('Type de classement')
          .addChoices({ name: 'XP', value: 'xp' }, { name: 'Portefeuille', value: 'wallet' })
      )
  )
  .addSubcommandGroup((group) =>
    group.setName('war').setDescription('Guerre de clans')
      .addSubcommand((sub) =>
        sub.setName('challenge').setDescription('Défier un clan')
          .addStringOption((opt) => opt.setName('clan').setDescription('Nom du clan adverse').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub.setName('accept').setDescription('Accepter un défi')
      )
      .addSubcommand((sub) =>
        sub.setName('status').setDescription('Voir le statut de votre guerre active')
      )
  );

export const module = 'clans';
export const cooldown = 5;

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();
  if (!interaction.guild) return;

  if (!(await isModuleEnabled(interaction.guild.id, 'clans'))) {
    await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'Le module clans est désactivé sur ce serveur.')] });
    return;
  }

  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  if (subcommandGroup === 'war') {
    if (subcommand === 'challenge') await handleWarChallenge(interaction);
    else if (subcommand === 'accept') await handleWarAccept(interaction);
    else if (subcommand === 'status') await handleWarStatus(interaction);
    return;
  }

  switch (subcommand) {
    case 'create':
      await handleCreate(interaction);
      break;
    case 'invite':
      await handleInvite(interaction);
      break;
    case 'leave':
      await handleLeave(interaction);
      break;
    case 'delete':
      await handleDelete(interaction);
      break;
    case 'info':
      await handleInfo(interaction);
      break;
    case 'leaderboard':
      await handleLeaderboard(interaction);
      break;
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('nom', true);
  const description = interaction.options.getString('description') ?? undefined;

  try {
    await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
    const clan = await createClan(interaction.guild!.id, name, interaction.user.id, description);

    const embed = successEmbed('Clan créé', `Le clan **${clan.name}** a été créé avec succès !`)
      .setColor(0x22c55e);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({
      embeds: [errorEmbed('Échec de la création', (err as Error).message)],
    });
  }
}

async function handleInvite(interaction: ChatInputCommandInteraction): Promise<void> {
  const targetUser = interaction.options.getUser('membre', true);
  if (targetUser.id === interaction.user.id) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous ne pouvez pas vous inviter vous-même.')] });
    return;
  }

  try {
    await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
    await ensureUser(targetUser.id, targetUser.username, targetUser.displayAvatarURL());

    const userClan = await getUserClan(interaction.guild!.id, interaction.user.id);
    if (!userClan) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous n\'êtes pas dans un clan.')] });
      return;
    }

    if (userClan.role === 'MEMBER') {
      await interaction.editReply({ embeds: [errorEmbed('Permission refusée', 'Seuls les officiers et le propriétaire peuvent inviter.')] });
      return;
    }

    await addMember(userClan.clan.id, interaction.guild!.id, targetUser.id);

    const embed = successEmbed('Membre invité', `**${targetUser.tag}** a rejoint le clan **${userClan.clan.name}** !`);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({
      embeds: [errorEmbed('Échec de l\'invitation', (err as Error).message)],
    });
  }
}

async function handleLeave(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const userClan = await getUserClan(interaction.guild!.id, interaction.user.id);
    if (!userClan) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous n\'êtes pas dans un clan.')] });
      return;
    }

    if (userClan.role === 'OWNER') {
      await interaction.editReply({
        embeds: [errorEmbed('Impossible', 'Le propriétaire ne peut pas quitter le clan. Utilisez `/clan delete` pour supprimer le clan.')],
      });
      return;
    }

    await removeMember(userClan.clan.id, interaction.guild!.id, interaction.user.id);
    await interaction.editReply({ embeds: [successEmbed('Clan quitté', `Vous avez quitté **${userClan.clan.name}**.`)] });
  } catch (err) {
    await interaction.editReply({
      embeds: [errorEmbed('Erreur', (err as Error).message)],
    });
  }
}

async function handleDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const userClan = await getUserClan(interaction.guild!.id, interaction.user.id);
    if (!userClan) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous n\'êtes pas dans un clan.')] });
      return;
    }

    await deleteClan(userClan.clan.id, interaction.guild!.id, interaction.user.id);
    await interaction.editReply({ embeds: [successEmbed('Clan supprimé', `Le clan **${userClan.clan.name}** a été supprimé.`)] });
  } catch (err) {
    await interaction.editReply({
      embeds: [errorEmbed('Erreur', (err as Error).message)],
    });
  }
}

async function handleInfo(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('nom');

  try {
    let clan;
    if (name) {
      clan = await getClanByName(interaction.guild!.id, name);
    } else {
      const userClan = await getUserClan(interaction.guild!.id, interaction.user.id);
      clan = userClan?.clan ?? null;
    }

    if (!clan) {
      await interaction.editReply({ embeds: [errorEmbed('Introuvable', 'Clan introuvable.')] });
      return;
    }

    const members = await getClanMembers(clan.id);
    const totalXp = await getClanTotalXp(interaction.guild!.id, clan.id);
    const totalWallet = await getClanTotalWallet(interaction.guild!.id, clan.id);

    const memberLines = await Promise.all(
      members.map(async (m) => {
        const user = await interaction.client.users.fetch(m.userId).catch(() => null);
        const name = user?.username ?? m.userId.slice(0, 8);
        const badge = m.role === 'OWNER' ? '👑' : m.role === 'OFFICER' ? '⭐' : '•';
        return `${badge} **${name}**`;
      })
    );

    const embed = createEmbed('default')
      .setTitle(`🏰 ${clan.name}`)
      .setDescription(clan.description ?? 'Aucune description')
      .addFields(
        { name: 'Propriétaire', value: `<@${clan.ownerId}>`, inline: true },
        { name: 'Membres', value: `${members.length}`, inline: true },
        { name: 'XP totale', value: `${totalXp} XP`, inline: true },
        { name: 'Portefeuille total', value: `${totalWallet} 🪙`, inline: true },
        { name: 'Membres', value: memberLines.join('\n') || 'Aucun membre' }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({
      embeds: [errorEmbed('Erreur', 'Impossible de récupérer les informations du clan.')],
    });
  }
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
  const type = interaction.options.getString('type') as 'xp' | 'wallet' | null;

  try {
    const ranking = await getClansLeaderboard(interaction.guild!.id, type ?? 'xp');

    if (ranking.length === 0) {
      await interaction.editReply({ embeds: [errorEmbed('Classement vide', 'Aucun clan sur ce serveur. Créez-en un avec `/clan create` !')] });
      return;
    }

    const title = type === 'wallet' ? '💰 Classement — Portefeuille' : '⚔️ Classement — XP';
    const unit = type === 'wallet' ? '🪙' : 'XP';

    const lines = ranking.map((c, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
      return `${medal} **${c.name}** — ${c.total} ${unit} (${c.memberCount} membres)`;
    });

    const embed = createEmbed('default')
      .setTitle(`🏆 ${title}`)
      .setDescription(lines.join('\n'))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({
      embeds: [errorEmbed('Erreur', 'Impossible de récupérer le classement.')],
    });
  }
}

async function handleWarChallenge(interaction: ChatInputCommandInteraction): Promise<void> {
  const opponentName = interaction.options.getString('clan', true);

  try {
    const userClan = await getUserClan(interaction.guild!.id, interaction.user.id);
    if (!userClan) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous n\'êtes pas dans un clan.')] });
      return;
    }

    if (userClan.role !== 'OWNER' && userClan.role !== 'OFFICER') {
      await interaction.editReply({ embeds: [errorEmbed('Permission refusée', 'Seuls le propriétaire et les officiers peuvent défier un clan.')] });
      return;
    }

    const userClanActive = await getActiveWarForClan(interaction.guild!.id, userClan.clan.id);
    if (userClanActive) {
      await interaction.editReply({ embeds: [errorEmbed('Guerre en cours', 'Votre clan a déjà une guerre active ou en attente.')] });
      return;
    }

    const opponent = await getClanByName(interaction.guild!.id, opponentName);
    if (!opponent) {
      await interaction.editReply({ embeds: [errorEmbed('Introuvable', 'Aucun clan trouvé avec ce nom.')] });
      return;
    }

    if (opponent.id === userClan.clan.id) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous ne pouvez pas défier votre propre clan.')] });
      return;
    }

    const opponentMembers = await getClanMembers(opponent.id);
    const prize = WAR_PRIZE_PER_MEMBER * Math.max(1, opponentMembers.length);

    const war = await startWar(interaction.guild!.id, userClan.clan.id, opponent.id);

    const embed = createEmbed('default')
      .setTitle('⚔️ Défi lancé !')
      .setDescription(`**${userClan.clan.name}** défie **${opponent.name}** en guerre de clans !`)
      .addFields(
        { name: 'Durée', value: '24 heures', inline: true },
        { name: 'Prix par gagnant', value: `${prize} 🪙`, inline: true },
        { name: 'Statut', value: 'En attente d\'acceptation...' }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({
      embeds: [errorEmbed('Échec du défi', (err as Error).message)],
    });
  }
}

async function handleWarAccept(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const userClan = await getUserClan(interaction.guild!.id, interaction.user.id);
    if (!userClan) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous n\'êtes pas dans un clan.')] });
      return;
    }

    if (userClan.role !== 'OWNER' && userClan.role !== 'OFFICER') {
      await interaction.editReply({ embeds: [errorEmbed('Permission refusée', 'Seuls le propriétaire et les officiers peuvent accepter un défi.')] });
      return;
    }

    const pendingWar = await getPendingWarForClan(interaction.guild!.id, userClan.clan.id);
    if (!pendingWar) {
      await interaction.editReply({ embeds: [errorEmbed('Aucun défi', 'Votre clan n\'a aucun défi en attente.')] });
      return;
    }

    const challenger = await getClan(interaction.guild!.id, pendingWar.challengerId);
    if (!challenger) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Le clan challenger est introuvable.')] });
      return;
    }

    const war = await acceptWar(pendingWar.id, interaction.guild!.id);

    const endsAt = Math.floor((war.endsAt!.getTime() - Date.now()) / 1000);

    const embed = createEmbed('default')
      .setTitle('⚔️ Guerre acceptée !')
      .setDescription(`**${userClan.clan.name}** vs **${challenger.name}** — Que le meilleur gagne !`)
      .addFields(
        { name: 'Fin dans', value: `${Math.floor(endsAt / 3600)}h ${Math.floor((endsAt % 3600) / 60)}m`, inline: true },
        { name: 'Prix par gagnant', value: `${war.prizePool} 🪙`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({
      embeds: [errorEmbed('Erreur', (err as Error).message)],
    });
  }
}

async function handleWarStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const userClan = await getUserClan(interaction.guild!.id, interaction.user.id);
    if (!userClan) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous n\'êtes pas dans un clan.')] });
      return;
    }

    const war = await getActiveWarForClan(interaction.guild!.id, userClan.clan.id);
    if (!war) {
      await interaction.editReply({ embeds: [infoEmbed('Aucune guerre', 'Votre clan n\'a aucune guerre active.')] });
      return;
    }

    const challenger = await getClan(interaction.guild!.id, war.challengerId);
    const opponent = await getClan(interaction.guild!.id, war.opponentId);
    if (!challenger || !opponent) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de récupérer les informations de la guerre.')] });
      return;
    }

    let statusText: string;
    let color: number;

    if (war.status === 'PENDING') {
      statusText = '⏳ En attente d\'acceptation';
      color = 0xf59e0b;
    } else if (war.status === 'ACTIVE') {
      statusText = '⚔️ En cours';
      color = 0xef4444;

      if (war.endsAt) {
        const remaining = war.endsAt.getTime() - Date.now();
        if (remaining <= 0) {
          const completed = await completeWar(war.id);
          if (completed?.winnerId) {
            const winnerName = completed.winnerId === challenger.id ? challenger.name : opponent.name;
            statusText = `🏆 Terminée — **${winnerName}** a gagné !`;
            color = 0x22c55e;
          } else {
            statusText = '🤝 Terminée — Égalité !';
            color = 0x888888;
          }
        } else {
          const hours = Math.floor(remaining / 3600000);
          const mins = Math.floor((remaining % 3600000) / 60000);
          statusText += ` — ${hours}h ${mins}m restantes`;
        }
      }
    } else if (war.status === 'COMPLETED') {
      if (war.winnerId) {
        const winnerName = war.winnerId === challenger.id ? challenger.name : opponent.name;
        statusText = `🏆 **${winnerName}** a gagné !`;
        color = war.winnerId === userClan.clan.id ? 0x22c55e : 0xef4444;
      } else {
        statusText = '🤝 Égalité';
        color = 0x888888;
      }
    } else {
      statusText = '❌ Annulée';
      color = 0x888888;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('⚔️ Guerre de clans')
      .setDescription(statusText)
      .addFields(
        { name: `🏰 ${challenger.name}`, value: `${war.challengerXp} XP`, inline: true },
        { name: 'VS', value: '⚔️', inline: true },
        { name: `🏰 ${opponent.name}`, value: `${war.opponentXp} XP`, inline: true },
        { name: 'Prix par gagnant', value: `${war.prizePool} 🪙`, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({
      embeds: [errorEmbed('Erreur', 'Impossible de récupérer le statut de la guerre.')],
    });
  }
}
