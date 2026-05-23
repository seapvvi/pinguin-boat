'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  UserPlus, Users, TrendingUp, Plus, X,
  Shield, Hash
} from 'lucide-react';
import { Card, Toggle, Input, Button, Badge, Modal, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, updateGuildSettings } from '@/lib/api';
import type { GuildConfig, AutoroleSettings, RoleReward } from '@pinguin/shared';

export default function AutorolesPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
        setRoleRewards(res.data.guild.levels.roleRewards ?? []);
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
    try {
      await updateGuildSettings(guildId, { autoroles: local, levels: { ...config?.levels, roleRewards } });
      load();
    } catch { /* ignore */ } finally {
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
          <Skeleton key={i} className="h-24 w-full rounded-[var(--radius)]" />
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Auto-rôles</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Gérez les rôles automatiques.</p>
        </div>
        <Button loading={saving} onClick={handleSave}>Enregistrer</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-[var(--accent)]" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Module auto-rôles</h2>
              </div>
              <Toggle checked={local.enabled} onChange={(v) => setLocal({ ...local, enabled: v })} />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-[var(--accent)]" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Rôles à l&apos;arrivée</h2>
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              <Input placeholder="ID du rôle" value={roleInput} onChange={(e) => setRoleInput(e.target.value)} className="flex-1" />
              <Button variant="secondary" size="sm" onClick={addJoinRole}><Plus size={12} /></Button>
            </div>
            {local.roleIds.length === 0 ? (
              <span className="text-xs text-[var(--text-secondary)]">Aucun rôle à l&apos;arrivée.</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {local.roleIds.map((id) => (
                  <span key={id} onClick={() => removeJoinRole(id)} className="cursor-pointer inline-flex">
                    <Badge variant="default">
                      {id.slice(0, 10)}… <span className="ml-1">×</span>
                    </Badge>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Input label="Délai (secondes)" type="number" value={String(local.delay)} onChange={(e) => setLocal({ ...local, delay: Number(e.target.value) })} />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-[var(--accent)]" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Rôles bots</h2>
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              <Input placeholder="ID du rôle" value={botRoleInput} onChange={(e) => setBotRoleInput(e.target.value)} className="flex-1" />
              <Button variant="secondary" size="sm" onClick={addBotRole}><Plus size={12} /></Button>
            </div>
            {local.botRoles.length === 0 ? (
              <span className="text-xs text-[var(--text-secondary)]">Aucun rôle pour les bots.</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {local.botRoles.map((id) => (
                  <span key={id} onClick={() => removeBotRole(id)} className="cursor-pointer inline-flex">
                    <Badge variant="default">
                      {id.slice(0, 10)}… <span className="ml-1">×</span>
                    </Badge>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-4 p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
              <div>
                <span className="text-sm text-[var(--text-primary)]">Ignorer les bots</span>
                <p className="text-xs text-[var(--text-secondary)]">Ne pas attribuer de rôles aux bots</p>
              </div>
              <Toggle checked={local.ignoreBots} onChange={(v) => setLocal({ ...local, ignoreBots: v })} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-[var(--accent)]" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Rôles par niveau</h2>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setRewardModal(true)}><Plus size={12} /> Ajouter</Button>
            </div>
            {roleRewards.length === 0 ? (
              <EmptyState title="Aucune récompense" description="Ajoutez des rôles à débloquer par niveau." />
            ) : (
              <div className="space-y-2">
                {roleRewards.map((rr, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
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
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Rôles par réaction</h2>
            <span className="text-xs text-[var(--text-secondary)]">Fonctionnalité à venir.</span>
          </Card>
        </div>
      </div>

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
