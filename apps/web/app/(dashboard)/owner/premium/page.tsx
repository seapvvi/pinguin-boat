'use client';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Crown, Flag
} from 'lucide-react';
import {
  Card, Button, Badge, Skeleton, EmptyState, ErrorMessage,
  Modal, Toggle
} from '@pinguin/ui';
import type { Column } from '@pinguin/ui';
import {
  fetchFeatureFlags, updateFeatureFlag, toggleAlphaMode,
  type FeatureFlag
} from '@/lib/api';

export default function OwnerPremiumPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [alphaMode, setAlphaMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAlphaConfirm, setShowAlphaConfirm] = useState(false);
  const [alphaToggleLoading, setAlphaToggleLoading] = useState(false);
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

      </div>

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


    </motion.div>
  );
}
