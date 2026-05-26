'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Trophy, TrendingUp, Plus, X, Users, MessageSquare, Mic
} from 'lucide-react';
import { Card, Toggle, Input, Button, Badge, Select, Modal, Skeleton, Table, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, fetchXPLeaderboard, updateGuildSettings } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import type { GuildConfig, LevelSettings, LeaderboardEntry, RoleReward } from '@pinguin/shared';
import type { Column } from '@pinguin/ui';
import { ModuleToggle } from '@/components/ModuleToggle';
import { DiscordSelect } from '@/components/DiscordSelect';
import { api } from '@/lib/api';

export default function LevelsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [local, setLocal] = useState<LevelSettings | null>(null);
  const [rewardModal, setRewardModal] = useState(false);
  const [newReward, setNewReward] = useState({ level: 1, roleId: '' });
  const [lbTab, setLbTab] = useState<'guild' | 'global'>('guild');
  const [globalLb, setGlobalLb] = useState<LeaderboardEntry[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, lbRes] = await Promise.all([
        fetchGuildSettings(guildId),
        fetchXPLeaderboard(guildId, { page: '1', limit: '20' }),
      ]);
      const settingsPayload = (settingsRes as any)?.data;
      if (settingsPayload) {
        setConfig(settingsPayload.guild);
        const levels = settingsPayload.guild.levels;
        setLocal({
          ...levels,
          roleRewards: levels?.roleRewards ?? [],
        });
      } else {
        setLocal(null);
      }
      const lbPayload = (lbRes as any)?.data;
      if (lbPayload) setLeaderboard(lbPayload.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const handleSave = async () => {
    if (!local) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await updateGuildSettings(guildId, { levels: local });
      if (res.success && res.data) setConfig(res.data.guild);
    } catch (e: any) {
      setSaveError(e?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const addReward = () => {
    if (!local) return;
    setLocal({
      ...local,
      roleRewards: [...(local.roleRewards ?? []), { level: newReward.level, roleId: newReward.roleId }],
    });
    setNewReward({ level: 1, roleId: '' });
    setRewardModal(false);
  };

  const removeReward = (index: number) => {
    if (!local) return;
    setLocal({
      ...local,
      roleRewards: (local.roleRewards ?? []).filter((_, i) => i !== index),
    });
  };

  const lbColumns: Column<LeaderboardEntry>[] = [
    { key: 'rank', label: '#', render: (e) => <span className="text-xs font-bold text-[var(--text-secondary)]">#{e.rank}</span> },
    { key: 'user', label: 'Utilisateur', render: (e) => (
      <div className="flex items-center gap-2">
        <img src={`https://cdn.discordapp.com/avatars/${e.userId}/${e.avatar}.png?size=32`} alt="" className="w-6 h-6 rounded-[0px]" />
        <span className="text-sm truncate max-w-[120px]">{e.username}</span>
      </div>
    )},
    { key: 'xp', label: 'XP', sortable: true, render: (e) => <span className="text-xs font-mono">{formatNumber(e.xp)}</span> },
    { key: 'level', label: 'Niveau', sortable: true, render: (e) => <Badge variant="info">{e.level}</Badge> },
  ];

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  if (loading || !local) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[var(--radius)]" />
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Niveaux / XP</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Gérez le système d&apos;XP et de niveaux.</p>
        </div>
        <Button loading={saving} onClick={handleSave}>Enregistrer</Button>
      </div>
      {saveError && <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] p-2 rounded mb-4">{saveError}</div>}

      <div className="mb-4">
        <ModuleToggle guildId={guildId} moduleKey="levels" label="Niveaux" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="space-y-6">
          <Card>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Paramètres</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded bg-[var(--bg-surface-alt)] text-sm text-[var(--text-secondary)] col-span-2">
                <strong className="text-[var(--text-primary)]">XP fixe (non modifiable)</strong>
                <p className="mt-1">10 XP / message · 15 XP / min en vocal · cooldown 60s</p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] self-end">
                <div>
                  <span className="text-sm text-[var(--text-primary)]">Cumul des rôles</span>
                  <p className="text-xs text-[var(--text-secondary)]">Empiler les récompenses</p>
                </div>
                <Toggle checked={local.stackRoles} onChange={(v) => setLocal({ ...local, stackRoles: v })} />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Récompenses de rôles</h2>
              <Button variant="secondary" size="sm" onClick={() => setRewardModal(true)}><Plus size={12} /> Ajouter</Button>
            </div>
            {(local.roleRewards ?? []).length === 0 ? (
              <span className="text-xs text-[var(--text-secondary)]">Aucune récompense définie.</span>
            ) : (
              <div className="space-y-2">
                {local.roleRewards.map((rr, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                    <div className="flex items-center gap-2">
                      <Badge variant="info">Niveau {rr.level}</Badge>
                      <span className="text-sm font-mono text-[var(--text-secondary)]">{rr.roleId.slice(0, 10)}…</span>
                    </div>
                    <button onClick={() => removeReward(i)} className="text-[var(--text-secondary)] hover:text-[var(--error)] transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Salons et rôles ignorés</h2>
            <Input placeholder="IDs des salons ignorés (séparés par des virgules)" />
            <div className="mt-3">
              <Input placeholder="IDs des rôles ignorés (séparés par des virgules)" />
            </div>
          </Card>
        </div>

        <Card padding={false}>
          <div className="p-5 border-b border-[var(--border-color)] flex gap-2">
            <button type="button" onClick={() => setLbTab('guild')} className={`text-sm px-3 py-1 rounded ${lbTab === 'guild' ? 'bg-[var(--accent)] text-[var(--bg-primary)]' : 'text-[var(--text-secondary)]'}`}>Serveur</button>
            <button type="button" onClick={async () => {
              setLbTab('global');
              const res = await api.get<{ entries: any[] } & { data: { entries: any[] } } & { success?: boolean }>(
                '/api/overview/leaderboard/global'
              );
              if ((res as any).success && (res as any).data) {
                const raw = (res.data as any).entries ?? [];
                setGlobalLb(raw.map((e: any, i: number) => ({
                  rank: e.rank ?? i + 1,
                  userId: e.userId,
                  username: e.username ?? 'Inconnu',
                  avatar: e.avatar,
                  xp: e.totalXp ?? e.xp ?? 0,
                  level: e.level ?? 0,
                })));
              }
            }} className={`text-sm px-3 py-1 rounded ${lbTab === 'global' ? 'bg-[var(--accent)] text-[var(--bg-primary)]' : 'text-[var(--text-secondary)]'}`}>Global</button>
          </div>
          {(lbTab === 'guild' ? leaderboard : globalLb).length === 0 ? (
            <EmptyState title="Aucune donnée" description="Le classement est vide." />
          ) : (
            <Table columns={lbColumns} data={lbTab === 'guild' ? leaderboard : globalLb} keyExtractor={(e) => e.userId} />
          )}
        </Card>
      </div>

      <Modal open={rewardModal} onClose={() => setRewardModal(false)} title="Ajouter une récompense">
        <div className="space-y-4">
          <Input label="Niveau requis" type="number" value={String(newReward.level)} onChange={(e) => setNewReward({ ...newReward, level: Number(e.target.value) })} />
          <DiscordSelect type="role" guildId={guildId} label="Rôle" value={newReward.roleId} onChange={(id) => setNewReward({ ...newReward, roleId: id })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setRewardModal(false)}>Annuler</Button>
            <Button onClick={addReward}>Ajouter</Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
