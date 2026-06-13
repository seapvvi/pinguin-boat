'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Gamepad2, Coins, Trophy, Dice1, Dice2, Swords, Target } from 'lucide-react';
import { Button, Skeleton, EmptyState, ErrorMessage, Input, Toggle } from '@pinguin/ui';
import {
  fetchMinigameSettings, updateMinigameSettings, fetchMinigameLeaderboard,
} from '@/lib/api';
import { ModuleToggle } from '@/components/ModuleToggle';
import { DiscordSelect } from '@/components/DiscordSelect';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';
import { ModuleGrid } from '@/components/layout/ModuleGrid';

interface MinigameConfig {
  id: string;
  name: string;
  description: string;
  icon: typeof Gamepad2;
  enabled: boolean;
  cooldown: number;
  gainMin: number;
  gainMax: number;
}

const DEFAULT_GAMES: Omit<MinigameConfig, 'icon'>[] = [
  { id: 'guess', name: 'Devinez le nombre', description: 'Trouvez le bon nombre entre 1 et 100 pour gagner des pièces.', enabled: true, cooldown: 30, gainMin: 5, gainMax: 50 },
  { id: 'rps', name: 'Pierre-Feuille-Ciseaux', description: 'Affrontez le bot dans un duel classique.', enabled: true, cooldown: 15, gainMin: 10, gainMax: 30 },
  { id: 'dice', name: 'Lancer de dés', description: 'Tentez votre chance au lancer de dés, double mise si vous gagnez.', enabled: true, cooldown: 10, gainMin: 5, gainMax: 100 },
  { id: 'coinflip', name: 'Pile ou face', description: 'Pariez sur pile ou face et doublez votre mise.', enabled: true, cooldown: 5, gainMin: 10, gainMax: 200 },
];

const GAME_ICONS: Record<string, typeof Gamepad2> = {
  guess: Target,
  rps: Swords,
  dice: Dice1,
  coinflip: Dice2,
};

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string | null;
  winnings: number;
  games: number;
}

export default function MinigamesPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<{ gamesChannelId?: string; betMin?: number; betMax?: number } | null>(null);

  const [gamesChannelId, setGamesChannelId] = useState('');
  const [betMin, setBetMin] = useState(10);
  const [betMax, setBetMax] = useState(1000);
  const [saving, setSaving] = useState(false);

  const [games, setGames] = useState<MinigameConfig[]>(
    DEFAULT_GAMES.map(g => ({ ...g, icon: GAME_ICONS[g.id] ?? Gamepad2 }))
  );
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMinigameSettings(guildId);
      const data = (res as { data?: { settings?: { gamesChannelId?: string; betMin?: number; betMax?: number; games?: Omit<MinigameConfig, 'icon'>[] } } })?.data;
      if (data?.settings) {
        setSettings(data.settings);
        setGamesChannelId(data.settings.gamesChannelId ?? '');
        setBetMin(data.settings.betMin ?? 10);
        setBetMax(data.settings.betMax ?? 1000);
        if (data.settings.games) {
          setGames(data.settings.games.map(g => ({ ...g, icon: GAME_ICONS[g.id] ?? Gamepad2 })));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  const loadLeaderboard = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const res = await fetchMinigameLeaderboard(guildId, { limit: '20' });
      const data = (res as { data?: { entries?: LeaderboardEntry[] } })?.data;
      setEntries(data?.entries ?? []);
    } catch { } finally {
      setEntriesLoading(false);
    }
  }, [guildId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  useEffect(() => {
    const interval = setInterval(() => { loadLeaderboard(); }, 15000);
    return () => clearInterval(interval);
  }, [loadLeaderboard]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateMinigameSettings(guildId, {
        gamesChannelId: gamesChannelId || null,
        betMin,
        betMax,
        games: games.map(({ icon: _icon, ...rest }) => rest),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const toggleGame = (id: string) => {
    setGames(prev => prev.map(g => g.id === id ? { ...g, enabled: !g.enabled } : g));
  };

  const updateGame = (id: string, patch: Partial<MinigameConfig>) => {
    setGames(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
  };

  if (error && !settings) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <PageLayout
        title="Minijeux"
        description="Définissez un salon dédié et suivez les meilleurs joueurs."
        actions={<Button loading={saving} onClick={handleSave}>Enregistrer</Button>}
      >
        {error && (
          <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 px-3 py-2 mb-4">{error}</div>
        )}

        <div className="mb-4">
          <ModuleToggle guildId={guildId} moduleKey="minigames" label="Minijeux" />
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <div className="space-y-6">
            <ModuleGrid>
              {games.map((game) => {
                const GameIcon = game.icon;
                return (
                  <SectionCard
                    key={game.id}
                    title={game.name}
                    description={game.description}
                    icon={<GameIcon size={16} />}
                    headerAction={
                      <Toggle checked={game.enabled} onChange={() => toggleGame(game.id)} />
                    }
                    expandable
                  >
                    <div className="space-y-4">
                      <Input
                        label="Cooldown (secondes)"
                        type="number"
                        value={String(game.cooldown)}
                        onChange={(e) => updateGame(game.id, { cooldown: Math.max(0, Number(e.target.value)) })}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Gain minimum"
                          type="number"
                          value={String(game.gainMin)}
                          onChange={(e) => updateGame(game.id, { gainMin: Math.max(0, Number(e.target.value)) })}
                        />
                        <Input
                          label="Gain maximum"
                          type="number"
                          value={String(game.gainMax)}
                          onChange={(e) => updateGame(game.id, { gainMax: Math.max(0, Number(e.target.value)) })}
                        />
                      </div>
                      <DiscordSelect
                        type="channel"
                        guildId={guildId}
                        label="Salon autorisé (optionnel)"
                        value=""
                        onChange={() => {}}
                        placeholder="Tous les salons"
                      />
                    </div>
                  </SectionCard>
                );
              })}
            </ModuleGrid>

            <SectionCard title="Classement des gains" icon={<Trophy size={16} />}>
              {entriesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : entries.length === 0 ? (
                <EmptyState
                  icon={<Gamepad2 size={32} />}
                  title="Aucune partie"
                  description="Le classement des gains apparaîtra ici dès que des parties seront jouées."
                />
              ) : (
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div key={entry.userId} className="flex items-center gap-3 p-3 border border-[var(--border-color)] bg-[var(--bg-surface)]">
                      <div className={`w-8 h-8 flex items-center justify-center text-sm font-bold shrink-0 ${
                        entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-500'
                        : entry.rank === 2 ? 'bg-gray-400/20 text-gray-300'
                        : entry.rank === 3 ? 'bg-amber-700/20 text-amber-600'
                        : 'bg-[var(--bg-surface-alt)] text-[var(--text-secondary)]'
                      }`}>
                        {entry.rank}
                      </div>
                      {entry.avatar ? (
                        <img
                          src={`https://cdn.discordapp.com/avatars/${entry.userId}/${entry.avatar}.png?size=64`}
                          alt=""
                          className="w-8 h-8"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-[var(--bg-surface-alt)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)]">
                          {entry.username?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{entry.username}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{entry.games} partie{entry.games > 1 ? 's' : ''}</p>
                      </div>
                      <div className={`flex items-center gap-1 text-sm font-semibold ${entry.winnings >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                        <Coins size={14} />
                        {entry.winnings >= 0 ? '+' : ''}{entry.winnings.toLocaleString('fr-FR')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        )}
      </PageLayout>
    </motion.div>
  );
}
