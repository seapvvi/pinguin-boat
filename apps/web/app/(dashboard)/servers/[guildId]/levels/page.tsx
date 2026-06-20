'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Plus, X, Eye, Trophy, Award, Zap, Bell, Medal, Loader2, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { Toggle, Input, Button, Badge, Modal, Table, EmptyState, Select } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, fetchXPLeaderboard, updateGuildSettings } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import type { GuildConfig, LevelSettings, LeaderboardEntry, RoleReward } from '@pinguin/shared';
import type { Column } from '@pinguin/ui';
import { ModuleToggle } from '@/components/ModuleToggle';
import { DiscordSelect } from '@/components/DiscordSelect';
import { api } from '@/lib/api';
import RankCardEditor from '@/components/levels/RankCardEditor';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';
import { ModuleGrid } from '@/components/layout/ModuleGrid';

const NOTIF_TYPES = [
  { value: 'CHANNEL', label: 'Message simple' },
  { value: 'DM', label: 'Message privé (DM)' },
];

const LEVEL_UP_VARIABLES = [
  { key: '{{user}}', label: 'Utilisateur' },
  { key: '{{level}}', label: 'Niveau' },
  { key: '{{server}}', label: 'Serveur' },
];

export default function LevelsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [local, setLocal] = useState<LevelSettings | null>(null);
  const [rewardModal, setRewardModal] = useState(false);
  const [newReward, setNewReward] = useState<RoleReward>({ level: 1, roleId: '', xpMultiplier: 1.0 });
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
      const settingsPayload = (settingsRes as { data?: { guild?: GuildConfig } })?.data;
      if (settingsPayload?.guild) {
        const levels = settingsPayload.guild.levels;
        setLocal({
          ...levels,
          roleRewards: levels?.roleRewards ?? [],
        });
      } else {
        setLocal(null);
      }
      const lbPayload = (lbRes as { data?: { entries?: LeaderboardEntry[] } })?.data;
      if (lbPayload) setLeaderboard(lbPayload.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const [saveBtnState, setSaveBtnState] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleSave = async () => {
    if (!local) return;
    setSaveBtnState('loading');
    setSaveError(null);
    try {
      await updateGuildSettings(guildId, { levels: local });
      setSaveBtnState('success');
      setTimeout(() => setSaveBtnState('idle'), 2000);
      toast.success('Paramètres enregistrés');
    } catch (e) {
      setSaveBtnState('idle');
      const msg = e instanceof Error ? e.message : 'Erreur lors de la sauvegarde';
      setSaveError(msg);
      toast.error(msg);
    }
  };

  const addReward = () => {
    if (!local) return;
    const mult = Math.max(0.1, Math.min(10, newReward.xpMultiplier ?? 1.0));
    setLocal({
      ...local,
      roleRewards: [...(local.roleRewards ?? []), { ...newReward, xpMultiplier: mult }],
    });
    setNewReward({ level: 1, roleId: '', xpMultiplier: 1.0 });
    setRewardModal(false);
  };

  const removeReward = (index: number) => {
    if (!local) return;
    setLocal({
      ...local,
      roleRewards: (local.roleRewards ?? []).filter((_, i) => i !== index),
    });
  };

  const previewMessage = useCallback(() => {
    const msg = local?.announcementMessage || '';
    return msg
      .replace('{{user}}', '@Jean#1234')
      .replace('{{level}}', '15')
      .replace('{{server}}', 'Mon Serveur');
  }, [local?.announcementMessage, local?.levelUpNotification]);

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-gray-300';
    if (rank === 3) return 'text-amber-600';
    return 'text-[var(--text-secondary)]';
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const lbColumns: Column<LeaderboardEntry>[] = [
    { key: 'rank', label: '#', render: (e) => (
      <span className={`text-xs font-bold ${getRankColor(e.rank)}`}>{getRankBadge(e.rank)}</span>
    )},
    { key: 'user', label: 'Utilisateur', render: (e) => (
      <div className="flex items-center gap-2">
        <img src={`https://cdn.discordapp.com/avatars/${e.userId}/${e.avatar}.png?size=32`} alt="" className="w-6 h-6" />
        <span className="text-sm truncate max-w-[120px]">{e.username}</span>
      </div>
    )},
    { key: 'xp', label: 'XP', sortable: true, render: (e) => <span className="text-xs font-mono">{formatNumber(e.xp)}</span> },
    { key: 'level', label: 'Niveau', sortable: true, render: (e) => <Badge variant="info">{e.level}</Badge> },
  ];

  function FadeInSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  if (!local) {
    // Fail-safe: éviter l’écran vide pendant les re-fetch/updates.
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <PageLayout title="Niveaux / XP" description="Chargement…">
          <SectionCard title="Paramètres XP">
            <div className="space-y-3">
              <div className="h-6 bg-[var(--bg-surface-alt)] rounded-[var(--radius)] w-2/3" />
              <div className="h-6 bg-[var(--bg-surface-alt)] rounded-[var(--radius)] w-full" />
              <div className="h-6 bg-[var(--bg-surface-alt)] rounded-[var(--radius)] w-5/6" />
            </div>
          </SectionCard>
        </PageLayout>
      </motion.div>
    );
  }


  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <PageLayout
        title="Niveaux / XP"
        description="Gérez le système d'XP et de niveaux."
        actions={
          <motion.button
            type="button"
            onClick={handleSave}
            disabled={saveBtnState === 'loading'}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              border: '1px solid var(--accent)',
              borderRadius: 6,
              backgroundColor: saveBtnState === 'success' ? 'rgba(34,197,94,0.1)' : 'var(--accent)',
              color: saveBtnState === 'success' ? '#22c55e' : 'var(--bg-primary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: saveBtnState === 'loading' ? 'not-allowed' : 'pointer',
              opacity: saveBtnState === 'loading' ? 0.7 : 1,
              transition: 'background-color 0.2s, color 0.2s, opacity 0.2s',
            }}
          >
            {saveBtnState === 'loading' && <Loader2 size={14} className="animate-spin" />}
            {saveBtnState === 'success' && <Check size={14} />}
            {saveBtnState === 'idle' && 'Enregistrer'}
            {saveBtnState === 'loading' && 'Enregistrement…'}
            {saveBtnState === 'success' && 'Sauvegardé !'}
          </motion.button>
        }
      >
        {saveError && (
          <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 px-3 py-2 mb-4">{saveError}</div>
        )}

        <FadeInSection>
          <div className="mb-4">
            <ModuleToggle guildId={guildId} moduleKey="levels" label="Niveaux" />
          </div>
        </FadeInSection>

        <ModuleGrid>
          <FadeInSection delay={0.05}>
          <SectionCard title="Paramètres XP" icon={<Zap size={16} />}>
            <div className="space-y-4">
              <div className="p-3 bg-[var(--bg-surface-alt)] text-sm text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">XP fixe (non modifiable)</strong>
                <p className="mt-1">10 XP / message · 15 XP / min en vocal · cooldown 60s</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)] self-end">
                <div>
                  <span className="text-sm text-[var(--text-primary)]">Cumul des rôles</span>
                  <p className="text-xs text-[var(--text-secondary)]">Empiler les récompenses</p>
                </div>
                <Toggle checked={local.stackRoles} onChange={(v) => setLocal({ ...local, stackRoles: v })} />
              </div>
            </div>
          </SectionCard>
          </FadeInSection>

          <FadeInSection delay={0.1}>
          <SectionCard title="Canal d'annonce" icon={<Bell size={16} />}>
            <div className="space-y-4">
              <Select
                label="Type de notification"
                options={NOTIF_TYPES}
                value={local.levelUpNotification || 'CHANNEL'}
                onChange={(e) => setLocal({ ...local, levelUpNotification: e.target.value as 'CHANNEL' | 'DM' | 'NONE' })}
              />
              <DiscordSelect
                type="channel"
                guildId={guildId}
                label="Salon d'annonce"
                value={local.announcementChannelId || ''}
                onChange={(id) => setLocal({ ...local, announcementChannelId: id })}
                channelTypes={[0]}
              />
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">
                  Message de level-up
                </label>
                <textarea
                  value={local.announcementMessage || ''}
                  onChange={(e) => setLocal({ ...local, announcementMessage: e.target.value })}
                  placeholder="Bravo {{user}}, tu as atteint le niveau **{{level}}** !"
                  rows={3}
                  className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Variables</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {LEVEL_UP_VARIABLES.map((v) => (
                    <code key={v.key} className="text-xs px-1.5 py-0.5 bg-[var(--bg-surface-alt)] text-[var(--accent)]">
                      {v.key}
                    </code>
                  ))}
                </div>
              </div>
              {local.announcementMessage && (
                <div className="p-3 bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
                  <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)] mb-1">
                    <Eye size={12} />
                    Aperçu
                  </div>
                  <p className="text-sm text-[var(--text-primary)]">{previewMessage()}</p>
                </div>
              )}
            </div>
          </SectionCard>
          </FadeInSection>
        </ModuleGrid>

        <FadeInSection delay={0.15}>
          <SectionCard title="Carte de rang" icon={<Medal size={16} />}>
            <RankCardEditor guildId={guildId} />
          </SectionCard>
        </FadeInSection>

        <FadeInSection delay={0.2}>
          <SectionCard title="Récompenses de rôles" icon={<Award size={16} />}>
            {(local.roleRewards ?? []).length === 0 ? (
              <span className="text-xs text-[var(--text-secondary)]">Aucune récompense définie.</span>
            ) : (
              <div>
                {(local.roleRewards ?? []).map((rr, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-4 px-4 py-3 text-sm ${i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-surface-alt)]'}`}
                  >
                    <div className="w-20">
                      <Badge variant="info">Niveau {rr.level}</Badge>
                    </div>
                    <div className="flex-1 font-mono text-xs text-[var(--text-secondary)]">
                      {rr.roleId.slice(0, 14)}…
                    </div>
                    <div className="w-28">
                      {rr.xpMultiplier != null && rr.xpMultiplier !== 1 ? (
                        <Badge variant="success">{rr.xpMultiplier}×</Badge>
                      ) : (
                        <span className="text-xs text-[var(--text-secondary)]">1×</span>
                      )}
                    </div>
                    <button onClick={() => removeReward(i)} className="text-[var(--text-secondary)] hover:text-[var(--error)] transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3">
              <Button variant="secondary" className="w-full" onClick={() => setRewardModal(true)}>
                <Plus size={12} /> Ajouter un palier
              </Button>
            </div>
          </SectionCard>
        </FadeInSection>

        <FadeInSection delay={0.25}>
          <SectionCard
            title="Classement"
            icon={<Trophy size={16} />}
            headerAction={
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setLbTab('guild')}
                  className={`text-xs px-2.5 py-1 ${lbTab === 'guild' ? 'bg-[var(--accent)] text-[var(--bg-primary)]' : 'text-[var(--text-secondary)] bg-[var(--bg-surface-alt)]'}`}
                >
                  Serveur
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setLbTab('global');
                    const res = await api.get<{ success?: boolean; data?: { entries?: unknown[] } }>(
                      '/api/overview/leaderboard/global'
                    );
                    if (res.success && res.data) {
                      const raw = (res.data.entries as unknown[]) ?? [];
                      setGlobalLb(raw.map((e: unknown, i: number) => {
                        const entry = e as { rank?: number; userId: string; username?: string; avatar?: string; totalXp?: number; xp?: number; level?: number; guildId?: string };
                        return {
                          rank: entry.rank ?? i + 1,
                          userId: entry.userId,
                          username: entry.username ?? 'Inconnu',
                          avatar: entry.avatar ?? '',
                          xp: entry.totalXp ?? entry.xp ?? 0,
                          level: entry.level ?? 0,
                          guildId: entry.guildId ?? '',
                        };
                      }));
                    }
                  }}
                  className={`text-xs px-2.5 py-1 ${lbTab === 'global' ? 'bg-[var(--accent)] text-[var(--bg-primary)]' : 'text-[var(--text-secondary)] bg-[var(--bg-surface-alt)]'}`}
                >
                  Global
                </button>
              </div>
            }
          >
            {(lbTab === 'guild' ? leaderboard : globalLb).length === 0 ? (
              <EmptyState title="Aucune donnée" description="Le classement est vide." />
            ) : (
              <Table columns={lbColumns} data={lbTab === 'guild' ? leaderboard : globalLb} keyExtractor={(e) => e.userId} />
            )}
            </SectionCard>
        </FadeInSection>
      </PageLayout>

      <Modal open={rewardModal} onClose={() => setRewardModal(false)} title="Ajouter un palier">
        <div className="space-y-4">
          <Input
            label="Niveau requis"
            type="number"
            value={String(newReward.level)}
            onChange={(e) => setNewReward({ ...newReward, level: Math.max(1, Number(e.target.value)) })}
          />
          <DiscordSelect
            type="role"
            guildId={guildId}
            label="Rôle"
            value={newReward.roleId}
            onChange={(id) => setNewReward({ ...newReward, roleId: id })}
          />
          <Input
            label="Multiplicateur XP (0.1 – 10)"
            type="number"
            step="0.1"
            min="0.1"
            max="10"
            value={String(newReward.xpMultiplier ?? 1.0)}
            onChange={(e) => setNewReward({ ...newReward, xpMultiplier: Math.max(0.1, Math.min(10, parseFloat(e.target.value) || 1.0)) })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setRewardModal(false)}>Annuler</Button>
            <Button onClick={addReward}>Ajouter</Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
