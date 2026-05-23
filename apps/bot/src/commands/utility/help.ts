import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from 'discord.js';
import { infoEmbed, createEmbed } from '../../services/embed';

const modules = [
  { name: 'moderation', description: 'Gestion des sanctions et de la modération' },
  { name: 'protection', description: 'Protection anti-spam et anti-raid' },
  { name: 'tickets', description: 'Système de tickets de support' },
  { name: 'logs', description: 'Journalisation des événements' },
  { name: 'levels', description: 'Système de niveaux et d\'XP' },
  { name: 'economy', description: 'Économie et monnaie virtuelle' },
  { name: 'music', description: 'Musique en salon vocal' },
  { name: 'giveaways', description: 'Organisation de giveaways' },
  { name: 'polls', description: 'Création de sondages' },
  { name: 'suggestions', description: 'Système de suggestions' },
  { name: 'welcome', description: 'Messages de bienvenue' },
  { name: 'autoroles', description: 'Rôles automatiques' },
  { name: 'embeds', description: 'Embeds personnalisés' },
];

const commandList: Record<string, { name: string; description: string }[]> = {
  moderation: [
    { name: '/ban', description: 'Bannir un utilisateur' },
    { name: '/tempban', description: 'Bannir temporairement' },
    { name: '/unban', description: 'Débannir un utilisateur' },
    { name: '/kick', description: 'Expulser un utilisateur' },
    { name: '/mute', description: 'Rendre muet un utilisateur' },
    { name: '/unmute', description: 'Retirer le mute' },
    { name: '/warn', description: 'Avertir un utilisateur' },
    { name: '/unwarn', description: 'Retirer un avertissement' },
    { name: '/purge', description: 'Supprimer des messages' },
    { name: '/slowmode', description: 'Définir le mode lent' },
    { name: '/lock', description: 'Verrouiller un salon' },
    { name: '/unlock', description: 'Déverrouiller un salon' },
    { name: '/nuke', description: 'Recréer un salon' },
    { name: '/history', description: 'Historique de modération' },
    { name: '/notes', description: 'Notes staff' },
    { name: '/automod', description: 'Configurer l\'auto-modération' },
  ],
  tickets: [{ name: '/ticket', description: 'Gérer les tickets' }],
  music: [
    { name: '/play', description: 'Jouer une musique' },
    { name: '/skip', description: 'Passer la musique' },
    { name: '/stop', description: 'Arrêter la musique' },
    { name: '/pause', description: 'Mettre en pause' },
    { name: '/resume', description: 'Reprendre la musique' },
    { name: '/queue', description: 'Voir la file d\'attente' },
    { name: '/nowplaying', description: 'Musique en cours' },
    { name: '/volume', description: 'Régler le volume' },
    { name: '/shuffle', description: 'Mélanger la file' },
    { name: '/loop', description: 'Mode répétition' },
    { name: '/previous', description: 'Musique précédente' },
    { name: '/autoplay', description: 'Lecture automatique' },
    { name: '/seek', description: 'Avancer dans la musique' },
    { name: '/remove', description: 'Retirer une musique' },
  ],
  levels: [
    { name: '/rank', description: 'Voir votre niveau' },
    { name: '/leaderboard', description: 'Classement XP' },
  ],
  economy: [
    { name: '/balance', description: 'Voir votre solde' },
    { name: '/daily', description: 'Récompense quotidienne' },
    { name: '/transfer', description: 'Transférer des pièces' },
    { name: '/shop', description: 'Voir la boutique' },
    { name: '/buy', description: 'Acheter un article' },
  ],
  giveaways: [{ name: '/giveaway', description: 'Gérer les giveaways' }],
  polls: [{ name: '/poll', description: 'Créer un sondage' }],
  suggestions: [
    { name: '/suggest', description: 'Faire une suggestion' },
    { name: '/approve', description: 'Approuver une suggestion' },
    { name: '/reject', description: 'Refuser une suggestion' },
  ],
  welcome: [{ name: '/welcome', description: 'Configurer les bienvenues' }],
  autoroles: [{ name: '/autorole', description: 'Gérer les rôles auto' }],
  embeds: [{ name: '/embed', description: 'Gérer les embeds' }],
  utility: [
    { name: '/help', description: 'Afficher cette aide' },
    { name: '/ping', description: 'Latence du bot' },
    { name: '/stats', description: 'Statistiques du bot' },
    { name: '/info', description: 'Informations utilisateur' },
    { name: '/invite', description: 'Inviter le bot' },
    { name: '/serverinfo', description: 'Informations du serveur' },
    { name: '/roles', description: 'Liste des rôles' },
  ],
};

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Afficher la liste des commandes ou les détails d\'un module')
  .addStringOption((opt) =>
    opt.setName('module')
      .setDescription('Module à consulter')
      .addChoices(
        { name: 'Modération', value: 'moderation' },
        { name: 'Protection', value: 'protection' },
        { name: 'Tickets', value: 'tickets' },
        { name: 'Logs', value: 'logs' },
        { name: 'Niveaux', value: 'levels' },
        { name: 'Économie', value: 'economy' },
        { name: 'Musique', value: 'music' },
        { name: 'Giveaways', value: 'giveaways' },
        { name: 'Sondages', value: 'polls' },
        { name: 'Suggestions', value: 'suggestions' },
        { name: 'Bienvenue', value: 'welcome' },
        { name: 'Rôles auto', value: 'autoroles' },
        { name: 'Embeds', value: 'embeds' },
        { name: 'Utilitaire', value: 'utility' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const moduleName = interaction.options.get('module')?.value as string | undefined;

  if (moduleName) {
    const commands = commandList[moduleName];
    const modInfo = modules.find((m) => m.name === moduleName);

    if (!commands) {
      await interaction.reply({ embeds: [createEmbed('default')
        .setTitle('📚 Aide')
        .setDescription(`Module **${moduleName}** introuvable.`)
      ], ephemeral: true });
      return;
    }

    const embed = createEmbed('default')
      .setTitle(`📚 Module ${modInfo?.description || moduleName}`)
      .setDescription(commands.map((c) => `**${c.name}** — ${c.description}`).join('\n'))
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else {
    const embed = createEmbed('default')
      .setTitle('📚 Aide — Pinguin BOAT')
      .setDescription('Voici la liste des modules disponibles. Utilisez `/help <module>` pour plus de détails.')
      .addFields(
        ...modules.map((m) => ({
          name: m.name.charAt(0).toUpperCase() + m.name.slice(1),
          value: m.description,
          inline: true,
        }))
      )
      .addFields({ name: 'Utilitaire', value: 'Commandes générales du bot', inline: true })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
}
