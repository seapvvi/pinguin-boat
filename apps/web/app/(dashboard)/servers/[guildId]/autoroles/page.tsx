'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Users, TrendingUp, Plus, X, Shield, Hash
} from 'lucide-react';
import { Card, Toggle, Input, Button, Badge, Modal, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, updateGuildSettings, api } from '@/lib/api';
import type { GuildConfig, AutoroleSettings, RoleReward } from '@pinguin/shared';
import { ModuleToggle } from '@/components/ModuleToggle';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';
import { ModuleGrid } from '@/components/layout/ModuleGrid';

const ROLE_COLORS = ['#5865f2', '#ed4245', '#57f287', '#fee75c', '#eb459e', '#00b0f4', '#95e5d7', '#ff73fa'];

function hashRoleColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ROLE_COLORS[Math.abs(hash) % ROLE_COLORS.length];
}

export default function AutorolesPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [local, setLocal] = useState<AutoroleSettings | null>(null);
  const [roleRewards, setRoleRewards] = useState<RoleReward[]>([]);
  const [roleInput, setRoleInput] = useState('');
  const [botRoleInput, setBotRoleInput] = useState('');
  const [rewardModal, setRewardModal] = useState(false);
  const [newReward, setNewReward] = useState({ level: 1, roleId: '' });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGuildSettings(guildId);
      if (res.success && res.data) {
        setConfig(res.data.guild);
        setLocal({ ...res.data.guild.autoroles });
        setRoleRewards(res.data.guild.levels?.roleRewards ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const addJoinRole = () => {
    if (!local || !roleInput.trim()) return;
    if (local.roleIds.includes(roleInput.trim())) return;
    setLocal({ ...local, roleIds: [...local.roleIds, roleInput.trim()] });
    setRoleInput('');
  };

  const removeJoinRole = (id: string) => {
    if (!local) return;
    setLocal({ ...local, roleIds: local.roleIds.filter((r) => r !== id) });
  };

  const addBotRole = () => {
    if (!local || !botRoleInput.trim()) return;
    if (local.botRoles.includes(botRoleInput.trim())) return;
    setLocal({ ...local, botRoles: [...local.botRoles, botRoleInput.trim()] });
    setBotRoleInput('');
  };

  const removeBotRole = (id: string) => {
    if (!local) return;
    setLocal({ ...local, botRoles: local.botRoles.filter((r) => r !== id) });
  };

  const addReward = () => {
    setRoleRewards([...roleRewards, { level: newReward.level, roleId: newReward.roleId }]);
    setNewReward({ level: 1, roleId: '' });
    setRewardModal(false);
  };

  const removeReward = (index: number) => {
    setRoleRewards(roleRewards.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!local) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.put(`/api/guilds/${guildId}/autoroles`, {
        enabled: local.enabled,
        roleIds: local.roleIds,
        botRoles: local.botRoles,
      });
      if (roleRewards.length > 0) {
        await updateGuildSettings(guildId, { levels: { ...config?.levels, roleRewards } });
      }
      load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

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
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <PageLayout
        title="Auto-rôles"
        description="Gérez les rôles automatiques."
        actions={<Button loading={saving} onClick={handleSave}>Enregistrer</Button>}
      >
        {saveError && (
          <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 px-3 py-2 mb-4">{saveError}</div>
        )}

        <div className="mb-4">
          <ModuleToggle guildId={guildId} moduleKey="autoroles" label="Rôles automatiques" />
        </div>

        <SectionCard title="Ajouter un rôle" icon={<Users size={16} />}>
          <div className="flex gap-2 mb-4">
            <Input placeholder="ID du rôle" value={roleInput} onChange={(e) => setRoleInput(e.target.value)} className="flex-1" />
            <Button variant="secondary" size="sm" onClick={addJoinRole}><Plus size={12} /> Ajouter un rôle</Button>
          </div>
          {local.roleIds.length === 0 ? (
            <span className="text-xs text-[var(--text-secondary)]">Aucun rôle à l'arrivée.</span>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {local.roleIds.map((id) => (
                <div key={id} className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 inline-block"
                      style={{ backgroundColor: hashRoleColor(id) }}
                    />
                    <span className="text-sm font-mono text-[var(--text-secondary)]">{id.slice(0, 12)}…</span>
                    <Badge variant="info">Arrivée</Badge>
                  </div>
                  <button onClick={() => removeJoinRole(id)} className="text-[var(--text-secondary)] hover:text-[var(--error)] transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="mt-6">
          <ModuleGrid>
            <SectionCard
              title="Rôles bots"
              icon={<Shield size={16} />}
            >
              <div className="flex gap-2 mb-3">
                <Input placeholder="ID du rôle" value={botRoleInput} onChange={(e) => setBotRoleInput(e.target.value)} className="flex-1" />
                <Button variant="secondary" size="sm" onClick={addBotRole}><Plus size={12} /></Button>
              </div>
              {local.botRoles.length === 0 ? (
                <span className="text-xs text-[var(--text-secondary)]">Aucun rôle pour les bots.</span>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {local.botRoles.map((id) => (
                    <div key={id} className="flex items-center justify-between p-2 bg-[var(--bg-surface-alt)]">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 inline-block"
                          style={{ backgroundColor: hashRoleColor(id) }}
                        />
                        <span className="text-sm font-mono text-[var(--text-secondary)]">{id.slice(0, 12)}…</span>
                      </div>
                      <button onClick={() => removeBotRole(id)} className="text-[var(--text-secondary)] hover:text-[var(--error)] transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-4 p-3 bg-[var(--bg-surface-alt)]">
                <div>
                  <span className="text-sm text-[var(--text-primary)]">Ignorer les bots</span>
                  <p className="text-xs text-[var(--text-secondary)]">Ne pas attribuer de rôles aux bots</p>
                </div>
                <Toggle checked={local.ignoreBots} onChange={(v) => setLocal({ ...local, ignoreBots: v })} />
              </div>
            </SectionCard>

            <SectionCard
              title="Rôles par niveau"
              icon={<TrendingUp size={16} />}
              headerAction={
                <Button variant="secondary" size="sm" onClick={() => setRewardModal(true)}>
                  <Plus size={12} /> Ajouter
                </Button>
              }
            >
              {roleRewards.length === 0 ? (
                <EmptyState title="Aucune récompense" description="Ajoutez des rôles à débloquer par niveau." />
              ) : (
                <div className="space-y-2">
                  {roleRewards.map((rr, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]">
                      <div className="flex items-center gap-2">
                        <Badge variant="info">Niveau {rr.level}</Badge>
                        <span className="text-sm font-mono text-[var(--text-secondary)]">{rr.roleId.slice(0, 12)}…</span>
                      </div>
                      <button onClick={() => removeReward(i)} className="text-[var(--text-secondary)] hover:text-[var(--error)] transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </ModuleGrid>
        </div>

        <div className="mt-6">
          <SectionCard title="Paramètres" icon={<Hash size={16} />}>
            <Input label="Délai (secondes)" type="number" value={String(local.delay)} onChange={(e) => setLocal({ ...local, delay: Number(e.target.value) })} />
          </SectionCard>
        </div>

        <div className="mt-6">
          <SectionCard title="Rôles par réaction" icon={<Hash size={16} />} expandable defaultExpanded={false}>
            <span className="text-xs text-[var(--text-secondary)]">Fonctionnalité à venir.</span>
          </SectionCard>
        </div>
      </PageLayout>

      <Modal open={rewardModal} onClose={() => setRewardModal(false)} title="Ajouter un rôle par niveau">
        <div className="space-y-4">
          <Input label="Niveau requis" type="number" value={String(newReward.level)} onChange={(e) => setNewReward({ ...newReward, level: Number(e.target.value) })} />
          <Input label="ID du rôle" value={newReward.roleId} onChange={(e) => setNewReward({ ...newReward, roleId: e.target.value })} placeholder="ID du rôle Discord" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setRewardModal(false)}>Annuler</Button>
            <Button onClick={addReward}>Ajouter</Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
