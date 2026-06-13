'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Users, Trophy, Settings, Eye, Crown
} from 'lucide-react';
import { Input, Toggle, Button, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchClans, fetchGuildSettings, updateGuildSettings, type Clan } from '@/lib/api';
import { ModuleToggle } from '@/components/ModuleToggle';
import { DiscordSelect } from '@/components/DiscordSelect';
import { useBackgroundRefresh } from '@/lib/hooks';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';

interface ClanSettings {
  maxMembers: number;
  autoLeaderRole: boolean;
  leaderRoleId: string | null;
  clanWars: boolean;
  minXpToCreate: number;
}

export default function ClansPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [clans, setClans] = useState<Clan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [config, setConfig] = useState<ClanSettings>({
    maxMembers: 25,
    autoLeaderRole: false,
    leaderRoleId: null,
    clanWars: true,
    minXpToCreate: 0,
  });

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [clansRes, settingsRes] = await Promise.all([
        fetchClans(guildId),
        fetchGuildSettings(guildId),
      ]);
      if (clansRes.success && clansRes.data) {
        setClans(clansRes.data.clans ?? []);
      }
      if (settingsRes.success && settingsRes.data) {
        const c = (settingsRes.data.guild as { clans?: Partial<ClanSettings> })?.clans;
        if (c) {
          setConfig(prev => ({ ...prev, ...c }));
        }
      }
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);
  useBackgroundRefresh(load, 15000, [guildId]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await updateGuildSettings(guildId, { clans: config });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const getLeader = (clan: Clan) => {
    if (!clan.members) return null;
    return clan.members.find(m => m.role === 'OWNER');
  };

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <PageLayout
        title="Clans"
        description="Gérez les clans du serveur."
        actions={<Button loading={saving} onClick={handleSave}>Enregistrer</Button>}
      >
        {saveError && (
          <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 px-3 py-2 mb-4">{saveError}</div>
        )}

        <div className="mb-4">
          <ModuleToggle guildId={guildId} moduleKey="clans" label="Clans" description="Activer le système de clans" />
        </div>

        <div className="space-y-6">
          <SectionCard title="Configuration" icon={<Settings size={16} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombre max de membres par clan"
                type="number"
                value={String(config.maxMembers)}
                onChange={(e) => setConfig({ ...config, maxMembers: Math.max(1, Number(e.target.value)) })}
              />
              <Input
                label="XP minimum pour créer un clan"
                type="number"
                value={String(config.minXpToCreate)}
                onChange={(e) => setConfig({ ...config, minXpToCreate: Math.max(0, Number(e.target.value)) })}
              />
              <div className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]">
                <div>
                  <span className="text-sm text-[var(--text-primary)]">Rôle leader automatique</span>
                  <p className="text-xs text-[var(--text-secondary)]">Attribuer un rôle au créateur</p>
                </div>
                <Toggle checked={config.autoLeaderRole} onChange={(v) => setConfig({ ...config, autoLeaderRole: v })} />
              </div>
              {config.autoLeaderRole && (
                <DiscordSelect
                  type="role"
                  guildId={guildId}
                  label="Rôle leader"
                  value={config.leaderRoleId ?? ''}
                  onChange={(id) => setConfig({ ...config, leaderRoleId: id || null })}
                />
              )}
              <div className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]">
                <div>
                  <span className="text-sm text-[var(--text-primary)]">Guerres de clans</span>
                  <p className="text-xs text-[var(--text-secondary)]">Les clans peuvent s'affronter</p>
                </div>
                <Toggle checked={config.clanWars} onChange={(v) => setConfig({ ...config, clanWars: v })} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Clans actifs" icon={<Users size={16} />}>
            {clans.length === 0 ? (
              <EmptyState title="Aucun clan" description="Créez un clan avec la commande /clan create dans Discord." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {clans.map((clan) => {
                  const leader = getLeader(clan);
                  return (
                    <div key={clan.id} className="border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-[var(--bg-surface-alt)] flex items-center justify-center text-lg shrink-0">
                            {clan.icon ?? clan.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{clan.name}</h3>
                            <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mt-0.5">
                              <span className="flex items-center gap-1">
                                <Users size={12} />
                                {clan.memberCount ?? 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <Trophy size={12} />
                                {clan.totalXp ?? 0} XP
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Eye size={14} className="mr-1" /> Voir
                        </Button>
                      </div>
                      {clan.description && (
                        <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">{clan.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] border-t border-[var(--border-color)] pt-3">
                        <Crown size={12} className="text-[var(--accent)]" />
                        {leader ? (
                          <span>{leader.username}</span>
                        ) : (
                          <span className="italic">Aucun leader</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </PageLayout>
    </motion.div>
  );
}
