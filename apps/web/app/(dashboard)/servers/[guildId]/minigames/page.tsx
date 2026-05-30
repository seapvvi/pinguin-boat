'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Gamepad2, Settings, Trophy, Coins } from 'lucide-react';
import { Card, Button, Skeleton, EmptyState, ErrorMessage, Input } from '@pinguin/ui';
import {
  fetchMinigameSettings, updateMinigameSettings, fetchMinigameLeaderboard,
} from '@/lib/api';
import { ModuleToggle } from '@/components/ModuleToggle';
import { DiscordSelect } from '@/components/DiscordSelect';

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
  const [settings, setSettings] = useState<any>(null);

  const [gamesChannelId, setGamesChannelId] = useState('');
  const [betMin, setBetMin] = useState(10);
  const [betMax, setBetMax] = useState(1000);
  const [saving, setSaving] = useState(false);

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);

  const [tab, setTab] = useState<'settings' | 'leaderboard'>('settings');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMinigameSettings(guildId);
      const data = (res as any)?.data;
      if (data?.settings) {
        setSettings(data.settings);
        setGamesChannelId(data.settings.gamesChannelId ?? '');
        setBetMin(data.settings.betMin ?? 10);
        setBetMax(data.settings.betMax ?? 1000);
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
      const data = (res as any)?.data;
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
      });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (error && !settings) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Minijeux</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Définissez un salon dédié et suivez les meilleurs joueurs.</p>
        </div>
        <ModuleToggle guildId={guildId} moduleKey="minigames" label="Minijeux" />
      </div>

      {error && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--error)] bg-[var(--error)]/10 p-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-[var(--radius)]" />)}
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-2 border-b border-[var(--border-color)]">
            <button
              onClick={() => setTab('settings')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'settings'
                  ? 'border-[var(--accent)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Settings size={14} className="inline mr-1.5" />
              Configuration
            </button>
            <button
              onClick={() => setTab('leaderboard')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'leaderboard'
                  ? 'border-[var(--accent)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Trophy size={14} className="inline mr-1.5" />
              Classement ({entries.length})
            </button>
          </div>

          {tab === 'settings' && (
            <Card className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Salon des minijeux</label>
                  <DiscordSelect guildId={guildId} type="channel" value={gamesChannelId} onChange={setGamesChannelId} placeholder="Tous les salons" />
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Laissez vide pour autoriser les minijeux partout.</p>
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Mise minimum</label>
                  <Input type="number" value={String(betMin)} onChange={(e) => setBetMin(parseInt(e.target.value) || 0)} min={0} />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Mise maximum</label>
                  <Input type="number" value={String(betMax)} onChange={(e) => setBetMax(parseInt(e.target.value) || 0)} min={0} />
                </div>
              </div>
              <div className="pt-2">
                <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
                  Sauvegarder
                </Button>
              </div>
            </Card>
          )}

          {tab === 'leaderboard' && (
            <div className="space-y-4">
              {entriesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-[var(--radius)]" />)}
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
                    <Card key={entry.userId} className="p-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                          entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-500'
                          : entry.rank === 2 ? 'bg-gray-400/20 text-gray-300'
                          : entry.rank === 3 ? 'bg-amber-700/20 text-amber-600'
                          : 'bg-[var(--bg-surface-alt)] text-[var(--text-secondary)]'
                        }`}>
                          {entry.rank}
                        </div>
                        {entry.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`https://cdn.discordapp.com/avatars/${entry.userId}/${entry.avatar}.png?size=64`}
                            alt=""
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-alt)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)]">
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
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
