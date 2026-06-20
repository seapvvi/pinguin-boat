'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Shield, MessageSquare, Terminal, Activity,
  Music, Gift, Gamepad2, Star, ClipboardList, Users,
  Command, Clock, Zap
} from 'lucide-react';
import { Card, Input, Badge, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings } from '@/lib/api';
import type { GuildConfig, ModuleName } from '@pinguin/shared';

interface Command {
  name: string;
  description: string;
  category: string;
  module: string;
  cooldown?: string;
}

const COMMANDS: Command[] = [
  // Moderation
  { name: 'ban', description: 'Bannir un utilisateur du serveur', category: 'moderation', module: 'moderation', cooldown: '3s' },
  { name: 'kick', description: 'Expulser un utilisateur du serveur', category: 'moderation', module: 'moderation', cooldown: '3s' },
  { name: 'mute', description: 'Silencer un utilisateur', category: 'moderation', module: 'moderation', cooldown: '3s' },
  { name: 'tempban', description: 'Bannir temporairement un utilisateur', category: 'moderation', module: 'moderation', cooldown: '3s' },
  { name: 'unban', description: 'Débannir un utilisateur', category: 'moderation', module: 'moderation', cooldown: '3s' },
  { name: 'purge', description: 'Supprimer plusieurs messages', category: 'moderation', module: 'moderation', cooldown: '5s' },
  { name: 'lock', description: 'Verrouiller un salon', category: 'moderation', module: 'moderation', cooldown: '5s' },
  { name: 'slowmode', description: 'Activer le mode lent sur un salon', category: 'moderation', module: 'moderation', cooldown: '5s' },
  { name: 'nuke', description: 'Recréer un salon (supprime tout)', category: 'moderation', module: 'moderation', cooldown: '30s' },
  { name: 'history', description: 'Voir l\'historique de modération d\'un utilisateur', category: 'moderation', module: 'moderation', cooldown: '3s' },
  { name: 'notes', description: 'Gérer les notes sur un utilisateur', category: 'moderation', module: 'moderation', cooldown: '3s' },
  { name: 'automod', description: 'Configurer l\'automodération', category: 'moderation', module: 'protection', cooldown: '5s' },
  
  // Economy
  { name: 'balance', description: 'Voir votre solde ou celui d\'un autre membre', category: 'economy', module: 'economy', cooldown: '3s' },
  { name: 'daily', description: 'Récupérer votre récompense quotidienne', category: 'economy', module: 'economy', cooldown: '24h' },
  { name: 'weekly', description: 'Récupérer votre récompense hebdomadaire', category: 'economy', module: 'economy', cooldown: '7d' },
  { name: 'work', description: 'Travailler pour gagner de l\'argent', category: 'economy', module: 'economy', cooldown: '1m' },
  { name: 'rob', description: 'Tenter de voler un autre utilisateur', category: 'economy', module: 'economy', cooldown: '1h' },
  { name: 'shop', description: 'Voir le boutique du serveur', category: 'economy', module: 'economy', cooldown: '5s' },
  { name: 'buy', description: 'Acheter un article dans la boutique', category: 'economy', module: 'economy', cooldown: '3s' },
  { name: 'inventory', description: 'Voir votre inventaire', category: 'economy', module: 'economy', cooldown: '3s' },
  { name: 'use', description: 'Utiliser un objet de votre inventaire', category: 'economy', module: 'economy', cooldown: '3s' },
  { name: 'deposit', description: 'Déposer de l\'argent en banque', category: 'economy', module: 'economy', cooldown: '3s' },
  { name: 'transfer', description: 'Transférer de l\'argent à un autre utilisateur', category: 'economy', module: 'economy', cooldown: '10s' },
  { name: 'leaderboard', description: 'Voir le classement économique', category: 'economy', module: 'economy', cooldown: '10s' },
  { name: 'market', description: 'Voir le marché des objets', category: 'economy', module: 'economy', cooldown: '5s' },
  { name: 'quests', description: 'Voir vos quêtes disponibles', category: 'economy', module: 'economy', cooldown: '5s' },
  { name: 'notify', description: 'Configurer les notifications économiques', category: 'economy', module: 'economy', cooldown: '5s' },
  
  // Levels
  { name: 'rank', description: 'Voir votre niveau et XP', category: 'levels', module: 'levels', cooldown: '5s' },
  { name: 'leaderboard', description: 'Voir le classement XP', category: 'levels', module: 'levels', cooldown: '10s' },
  { name: 'xp-boost', description: 'Activer un boost d\'XP', category: 'levels', module: 'levels', cooldown: '1h' },
  { name: 'notify-levelup', description: 'Configurer les notifications de niveau', category: 'levels', module: 'levels', cooldown: '5s' },
  
  // Fun
  { name: 'meme', description: 'Afficher un meme aléatoire', category: 'fun', module: 'fun', cooldown: '5s' },
  
  // Giveaways
  { name: 'giveaway', description: 'Gérer les giveaways (start, end, reroll, cancel)', category: 'giveaways', module: 'giveaways', cooldown: '5s' },
  { name: 'giveaway-join', description: 'Participer à un giveaway', category: 'giveaways', module: 'giveaways', cooldown: '1s' },
  
  // Minigames
  { name: 'blackjack', description: 'Jouer au Blackjack', category: 'minigames', module: 'minigames', cooldown: '5s' },
  { name: 'connect4', description: 'Jouer au Puissance 4', category: 'minigames', module: 'minigames', cooldown: '5s' },
  { name: 'guess', description: 'Jeu de devinette de nombre', category: 'minigames', module: 'minigames', cooldown: '5s' },
  { name: 'hangman', description: 'Jeu du pendu', category: 'minigames', module: 'minigames', cooldown: '5s' },
  { name: 'morpion', description: 'Jouer au Morpion', category: 'minigames', module: 'minigames', cooldown: '5s' },
  { name: 'poker', description: 'Jouer au Poker', category: 'minigames', module: 'minigames', cooldown: '5s' },
  { name: 'race', description: 'Course de personnages', category: 'minigames', module: 'minigames', cooldown: '5s' },
  { name: 'rps', description: 'Pierre-Feuille-Ciseaux', category: 'minigames', module: 'minigames', cooldown: '3s' },
  
  // Music
  { name: 'play', description: 'Lire une musique', category: 'music', module: 'music', cooldown: '3s' },
  { name: 'skip', description: 'Passer la musique actuelle', category: 'music', module: 'music', cooldown: '3s' },
  { name: 'queue', description: 'Voir la file d\'attente', category: 'music', module: 'music', cooldown: '3s' },
  { name: 'pause', description: 'Mettre en pause la musique', category: 'music', module: 'music', cooldown: '3s' },
  { name: 'resume', description: 'Reprendre la musique', category: 'music', module: 'music', cooldown: '3s' },
  { name: 'stop', description: 'Arrêter la musique', category: 'music', module: 'music', cooldown: '3s' },
  { name: 'volume', description: 'Modifier le volume', category: 'music', module: 'music', cooldown: '3s' },
  { name: 'shuffle', description: 'Mélanger la file d\'attente', category: 'music', module: 'music', cooldown: '5s' },
  { name: 'loop', description: 'Activer/désactiver la répétition', category: 'music', module: 'music', cooldown: '3s' },
  { name: 'seek', description: 'Avancer/reculer dans la musique', category: 'music', module: 'music', cooldown: '3s' },
  { name: 'nowplaying', description: 'Voir la musique en cours', category: 'music', module: 'music', cooldown: '3s' },
  { name: 'lyrics', description: 'Voir les paroles de la musique', category: 'music', module: 'music', cooldown: '5s' },
  
  // Tickets
  { name: 'ticket', description: 'Créer un ticket de support', category: 'tickets', module: 'tickets', cooldown: '10s' },
  
  // Polls
  { name: 'poll', description: 'Créer un sondage', category: 'polls', module: 'polls', cooldown: '10s' },
  
  // Suggestions
  { name: 'suggest', description: 'Faire une suggestion', category: 'suggestions', module: 'suggestions', cooldown: '30s' },
  
  // Welcome
  { name: 'test-welcome', description: 'Tester le message de bienvenue', category: 'welcome', module: 'welcome', cooldown: '10s' },
  
  // Autoroles
  { name: 'autorole', description: 'Configurer les autorôles', category: 'autoroles', module: 'autoroles', cooldown: '5s' },
  
  // Embeds
  { name: 'embed', description: 'Envoyer un embed personnalisé', category: 'embeds', module: 'embeds', cooldown: '5s' },
  
  // Forms
  { name: 'forms-config', description: 'Configurer les formulaires', category: 'forms', module: 'forms', cooldown: '5s' },
  { name: 'forms-submit', description: 'Soumettre un formulaire', category: 'forms', module: 'forms', cooldown: '10s' },
  
  // Clans
  { name: 'clan', description: 'Gérer les clans', category: 'clans', module: 'clans', cooldown: '5s' },
  
  // Starboard
  { name: 'starboard', description: 'Configurer le starboard', category: 'starboard', module: 'starboard', cooldown: '5s' },
  
  // Notifications
  { name: 'notify-stream', description: 'Configurer les notifications de stream', category: 'notifications', module: 'notifications', cooldown: '5s' },
  
  // Admin
  { name: 'event', description: 'Gérer les événements bot', category: 'admin', module: 'admin', cooldown: '5s' },
];

const CATEGORIES = [
  { key: 'all', label: 'Tous', icon: <Command size={16} /> },
  { key: 'moderation', label: 'Modération', icon: <Shield size={16} /> },
  { key: 'economy', label: 'Économie', icon: <Activity size={16} /> },
  { key: 'levels', label: 'Niveaux', icon: <Zap size={16} /> },
  { key: 'fun', label: 'Fun', icon: <Gamepad2 size={16} /> },
  { key: 'giveaways', label: 'Giveaways', icon: <Gift size={16} /> },
  { key: 'minigames', label: 'Minijeux', icon: <Gamepad2 size={16} /> },
  { key: 'music', label: 'Musique', icon: <Music size={16} /> },
  { key: 'tickets', label: 'Tickets', icon: <MessageSquare size={16} /> },
  { key: 'polls', label: 'Sondages', icon: <ClipboardList size={16} /> },
  { key: 'suggestions', label: 'Suggestions', icon: <Star size={16} /> },
  { key: 'welcome', label: 'Bienvenue', icon: <Users size={16} /> },
  { key: 'autoroles', label: 'Autorôles', icon: <Shield size={16} /> },
  { key: 'embeds', label: 'Embeds', icon: <Terminal size={16} /> },
  { key: 'forms', label: 'Formulaires', icon: <ClipboardList size={16} /> },
  { key: 'clans', label: 'Clans', icon: <Users size={16} /> },
  { key: 'starboard', label: 'Starboard', icon: <Star size={16} /> },
  { key: 'notifications', label: 'Notifications', icon: <MessageSquare size={16} /> },
  { key: 'admin', label: 'Admin', icon: <Shield size={16} /> },
];

const MODULE_LABELS: Record<string, string> = {
  moderation: 'Modération',
  protection: 'Protection',
  tickets: 'Tickets',
  logs: 'Logs',
  levels: 'Niveaux',
  economy: 'Économie',
  music: 'Musique',
  giveaways: 'Giveaways',
  polls: 'Sondages',
  suggestions: 'Suggestions',
  welcome: 'Bienvenue',
  autoroles: 'Autorôles',
  embeds: 'Embeds',
  minigames: 'Minijeux',
  starboard: 'Starboard',
  forms: 'Formulaires',
  clans: 'Clans',
  notifications: 'Notifications',
  fun: 'Fun',
  admin: 'Admin',
};

export default function CommandsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGuildSettings(guildId);
      if (res.success && res.data) {
        setConfig(res.data.guild);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const isModuleEnabled = (module: string) => {
    if (!config?.disabledModules) return true;
    return !config.disabledModules.includes(module.toUpperCase() as ModuleName);
  };

  const filteredCommands = COMMANDS.filter((cmd) => {
    const matchesCategory = selectedCategory === 'all' || cmd.category === selectedCategory;
    const matchesSearch = cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         cmd.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Commandes</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Référence des commandes disponibles pour ce serveur.</p>
      </div>

      <div className="mb-6">
        <Input
          placeholder="Rechercher une commande..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] text-sm transition-colors ${
              selectedCategory === cat.key
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-surface-alt)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-16 w-full" />
            </Card>
          ))}
        </div>
      ) : filteredCommands.length === 0 ? (
        <EmptyState title="Aucune commande" description="Aucune commande ne correspond à votre recherche." />
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedCommands).map(([category, commands]) => (
            <Card key={category}>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                {CATEGORIES.find((c) => c.key === category)?.icon}
                {CATEGORIES.find((c) => c.key === category)?.label}
              </h2>
              <div className="space-y-2">
                {commands.map((cmd) => {
                  const enabled = isModuleEnabled(cmd.module);
                  return (
                    <div
                      key={cmd.name}
                      className={`flex items-center justify-between py-3 px-4 rounded-[var(--radius-sm)] ${
                        enabled
                          ? 'bg-[var(--bg-surface-alt)]'
                          : 'bg-[var(--bg-surface-alt)] opacity-50'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-sm font-mono text-[var(--accent)]">/{cmd.name}</code>
                          {cmd.cooldown && (
                            <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                              <Clock size={12} />
                              {cmd.cooldown}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--text-secondary)]">{cmd.description}</p>
                      </div>
                      <Badge variant={enabled ? 'success' : 'error'}>
                        {MODULE_LABELS[cmd.module] || cmd.module}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
