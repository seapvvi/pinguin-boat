'use client';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Crown, ToggleLeft, Flag, Shield, User, Server,
  Plus, Trash2, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';
import {
  Card, Button, Badge, Skeleton, EmptyState, ErrorMessage,
  Modal, Input, Select, Toggle, Table
} from '@pinguin/ui';
import type { Column } from '@pinguin/ui';
import {
  fetchFeatureFlags, updateFeatureFlag, toggleAlphaMode,
  grantPremium, revokePremium, fetchOwnerUsers, fetchOwnerServers
} from '@/lib/api';

interface FeatureFlag {
  key: string;
  name: string;
  enabled: boolean;
  tier: string;
  description?: string;
}

interface PremiumGrant {
  id: string;
  targetId: string;
  targetName?: string;
  targetType: 'USER' | 'GUILD';
  plan: string;
  expiresAt?: string;
}

export default function OwnerPremiumPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [alphaMode, setAlphaMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAlphaConfirm, setShowAlphaConfirm] = useState(false);
  const [alphaToggleLoading, setAlphaToggleLoading] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantType, setGrantType] = useState<'USER' | 'GUILD'>('USER');
  const [grantTargetId, setGrantTargetId] = useState('');
  const [grantPlan, setGrantPlan] = useState('PRO');
  const [actionLoading, setActionLoading] = useState(false);
  const [flagToggling, setFlagToggling] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [flagsRes] = await Promise.all([
        fetchFeatureFlags(),
      ]);
      if (flagsRes.success && flagsRes.data) {
        setFlags(flagsRes.data.flags ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAlphaToggle = async () => {
    setAlphaToggleLoading(true);
    try {
      await toggleAlphaMode(!alphaMode);
      setAlphaMode(!alphaMode);
      setShowAlphaConfirm(false);
    } catch { /* ignore */ } finally { setAlphaToggleLoading(false); }
  };

  const handleFlagToggle = async (flag: FeatureFlag, enabled: boolean) => {
    setFlagToggling(flag.key);
    try {
      await updateFeatureFlag(flag.key, enabled, flag.tier);
      setFlags((prev) => prev.map((f) => f.key === flag.key ? { ...f, enabled } : f));
    } catch { /* ignore */ } finally { setFlagToggling(null); }
  };

  const handleGrant = async () => {
    if (!grantTargetId.trim()) return;
    setActionLoading(true);
    try {
      const payload = grantType === 'USER'
        ? { userId: grantTargetId.trim(), plan: grantPlan }
        : { guildId: grantTargetId.trim(), plan: grantPlan };
      await grantPremium(payload);
      setShowGrantModal(false);
      setGrantTargetId('');
    } catch { /* ignore */ } finally { setActionLoading(false); }
  };

  const flagColumns: Column<FeatureFlag>[] = [
    { key: 'name', label: 'Fonctionnalité', render: (f: FeatureFlag) => (
      <div>
        <span className="text-sm text-[var(--text-primary)]">{f.name}</span>
        <p className="text-xs text-[var(--text-secondary)]">{f.description ?? f.key}</p>
      </div>
    )},
    {
      key: 'enabled', label: 'Activé', render: (f: FeatureFlag) => (
        <Toggle checked={f.enabled} onChange={(v) => handleFlagToggle(f, v)} disabled={flagToggling === f.key} />
      ),
    },
    {
      key: 'tier', label: 'Min. Tier', render: (f: FeatureFlag) => (
        <Badge variant={f.tier === 'FREE' ? 'default' : 'info'}>{f.tier}</Badge>
      ),
    },
  ];

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Gestion Premium</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Gérez les plans premium, feature flags et accès.</p>
      </div>

      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown size={20} className="text-[var(--warning)]" />
            <div>
              <span className="text-sm font-semibold text-[var(--text-primary)]">Mode Alpha (gratuit pour tous)</span>
              <p className="text-xs text-[var(--text-secondary)]">Toutes les fonctionnalités premium sont gratuites</p>
            </div>
          </div>
          <Toggle checked={alphaMode} onChange={() => setShowAlphaConfirm(true)} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Feature Flags</h2>
            <Flag size={16} className="text-[var(--text-secondary)]" />
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-sm)]" />)}
            </div>
          ) : flags.length === 0 ? (
            <EmptyState title="Aucun flag" description="Aucun feature flag configuré." />
          ) : (
            <div className="space-y-2">
              {flags.map((flag) => (
                <div key={flag.key} className="flex items-center justify-between py-2.5 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                  <div>
                    <span className="text-sm text-[var(--text-primary)]">{flag.name}</span>
                    <p className="text-xs text-[var(--text-secondary)]">{flag.key}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={flag.tier === 'FREE' ? 'default' : 'info'}>{flag.tier}</Badge>
                    <Toggle checked={flag.enabled} onChange={(v) => handleFlagToggle(flag, v)} disabled={flagToggling === flag.key} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Attributions Premium</h2>
            <Button variant="secondary" size="sm" onClick={() => setShowGrantModal(true)}><Plus size={14} /> Attribuer</Button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-sm)]" />)}
            </div>
          ) : (
            <EmptyState icon={<Crown size={24} />} title="Gérer les accès" description="Attribuez ou révoquez l'accès premium à des utilisateurs ou serveurs." />
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Plans premium</h2>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: 'BASIC', price: '5 €/mois', features: ['Commandes premium', 'Support prioritaire', '1 serveur'] },
              { name: 'PRO', price: '10 €/mois', features: ['Tout Basic +', 'Multi-serveurs (5)', 'Fonctionnalités avancées'] },
              { name: 'ENTERPRISE', price: '25 €/mois', features: ['Tout PRO +', 'Serveurs illimités', 'API dédiée', 'Support VIP'] },
            ].map((plan) => (
              <div key={plan.name} className="p-4 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-[var(--radius-sm)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{plan.name}</span>
                  <Badge variant="info">{plan.price}</Badge>
                </div>
                <ul className="space-y-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      <CheckCircle size={10} className="text-[var(--success)]" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showAlphaConfirm} onClose={() => setShowAlphaConfirm(false)} title="Confirmer le mode alpha">
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {alphaMode
            ? 'Désactiver le mode alpha signifie que seuls les utilisateurs premium auront accès aux fonctionnalités payantes.'
            : 'Activer le mode alpha rend toutes les fonctionnalités premium gratuites pour tout le monde.'}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setShowAlphaConfirm(false)}>Annuler</Button>
          <Button variant={alphaMode ? 'danger' : 'success'} size="sm" loading={alphaToggleLoading} onClick={handleAlphaToggle}>
            {alphaMode ? 'Désactiver' : 'Activer'}
          </Button>
        </div>
      </Modal>

      <Modal open={showGrantModal} onClose={() => setShowGrantModal(false)} title="Attribuer un accès premium">
        <div className="space-y-4">
          <Select label="Type" options={[
            { value: 'USER', label: 'Utilisateur' },
            { value: 'GUILD', label: 'Serveur' },
          ]} value={grantType} onChange={(e) => setGrantType(e.target.value as 'USER' | 'GUILD')} />
          <Input label="ID de la cible" placeholder="Entrez l'ID Discord..." value={grantTargetId} onChange={(e) => setGrantTargetId(e.target.value)} />
          <Select label="Plan" options={[
            { value: 'BASIC', label: 'BASIC' },
            { value: 'PRO', label: 'PRO' },
            { value: 'ENTERPRISE', label: 'ENTERPRISE' },
          ]} value={grantPlan} onChange={(e) => setGrantPlan(e.target.value)} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowGrantModal(false)}>Annuler</Button>
            <Button size="sm" loading={actionLoading} disabled={!grantTargetId.trim()} onClick={handleGrant}>Attribuer</Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
