'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Swords, Sliders, Users, MessageSquare, Hash, AlertTriangle } from 'lucide-react';
import { Card, Toggle, Input, Select, Button, Skeleton } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, api } from '@/lib/api';
import type { GuildConfig, ProtectionSettings } from '@pinguin/shared';
import { ModuleToggle } from '@/components/ModuleToggle';
import { PermissionGate } from '@/components/PermissionGate';
import { DiscordSelect } from '@/components/DiscordSelect';
import { useAutoSave } from '@/lib/hooks';

export default function ProtectionPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [local, setLocal] = useState<ProtectionSettings | null>(null);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGuildSettings(guildId);
      if (res.success && res.data) {
        setConfig(res.data.guild);
        const p = res.data.guild.protection as ProtectionSettings & { emergencyMode?: boolean };
        setLocal({ ...p });
        setEmergencyActive(!!p.emergencyMode);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const saveProtection = async (data: ProtectionSettings) => {
    await api.put(`/api/guilds/${guildId}/protection`, data);
  };

  useAutoSave(local, saveProtection, { enabled: !!local });

  const update = (key: keyof ProtectionSettings, value: unknown) => {
    if (!local) return;
    setLocal({ ...local, [key]: value });
  };

  const handleSave = async () => {
    if (!local) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.put(`/api/guilds/${guildId}/protection`, local);
      await load();
    } catch (e: any) {
      setSaveError(e?.message || 'Erreur lors de la sauvegarde');
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
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-[var(--radius)]" />
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Protection / Anti-raid</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Protégez votre serveur contre les raids et les abus.</p>
        </div>
        <Button loading={saving} onClick={handleSave}>Enregistrer</Button>
      </div>
      {saveError && <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] p-2 rounded mb-4">{saveError}</div>}

      <PermissionGate permission="manageGuild">
      <div className="mb-4">
        <ModuleToggle guildId={guildId} moduleKey="protection" label="Protection" />
      </div>

      <div className="space-y-6">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Swords size={18} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Anti-raid</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
              <div>
                <span className="text-sm text-[var(--text-primary)]">Anti-raid</span>
                <p className="text-xs text-[var(--text-secondary)]">Détection de raids</p>
              </div>
              <Toggle checked={local.antiRaid} onChange={(v) => update('antiRaid', v)} />
            </div>
            <Input label="Seuil de raid (joins/minute)" type="number" value={String(local.raidThreshold)} onChange={(e) => update('raidThreshold', Number(e.target.value))} />
            <Input label="Intervalle de raid (secondes)" type="number" value={String(local.raidInterval)} onChange={(e) => update('raidInterval', Number(e.target.value))} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={18} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Anti-spam</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
              <div>
                <span className="text-sm text-[var(--text-primary)]">Anti-spam</span>
                <p className="text-xs text-[var(--text-secondary)]">Limite de messages</p>
              </div>
              <Toggle checked={local.antiSpam} onChange={(v) => update('antiSpam', v)} />
            </div>
            <Input label="Seuil de spam (messages/seconde)" type="number" value={String(local.spamThreshold)} onChange={(e) => update('spamThreshold', Number(e.target.value))} />
            <Input label="Intervalle de spam (secondes)" type="number" value={String(local.spamInterval)} onChange={(e) => update('spamInterval', Number(e.target.value))} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Hash size={18} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Anti-mentions & Liens</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
              <div>
                <span className="text-sm text-[var(--text-primary)]">Anti-mass mention</span>
                <p className="text-xs text-[var(--text-secondary)]">Limite de mentions</p>
              </div>
              <Toggle checked={local.antiMassMention} onChange={(v) => update('antiMassMention', v)} />
            </div>
            <Input label="Seuil de mentions" type="number" value={String(local.mentionThreshold)} onChange={(e) => update('mentionThreshold', Number(e.target.value))} />
            <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
              <div>
                <span className="text-sm text-[var(--text-primary)]">Anti-liens</span>
                <p className="text-xs text-[var(--text-secondary)]">Bloque les liens</p>
              </div>
              <Toggle checked={local.antiLink} onChange={(v) => update('antiLink', v)} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Anti-alts</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
              <div>
                <span className="text-sm text-[var(--text-primary)]">Anti-alts</span>
                <p className="text-xs text-[var(--text-secondary)]">Bloque les comptes récents</p>
              </div>
              <Toggle checked={local.antiAlts} onChange={(v) => update('antiAlts', v)} />
            </div>
            <Input label="Âge min. du compte (jours)" type="number" value={String(local.altAccountAge)} onChange={(e) => update('altAccountAge', Number(e.target.value))} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Sliders size={18} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Niveau de vérification</h2>
          </div>
          <Select
            label="Niveau"
            options={[
              { value: 'NONE', label: 'Aucun' },
              { value: 'LOW', label: 'Bas' },
              { value: 'MEDIUM', label: 'Moyen' },
              { value: 'HIGH', label: 'Élevé' },
            ]}
            value={local.verificationLevel}
            onChange={(e) => update('verificationLevel', e.target.value)}
          />
          <div className="flex items-center justify-between mt-4 p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
            <div>
              <span className="text-sm text-[var(--text-primary)]">Vérification par Captcha</span>
              <p className="text-xs text-[var(--text-secondary)]">Oblige un captcha à l&apos;arrivée</p>
            </div>
            <Toggle checked={local.captchaVerification} onChange={(v) => update('captchaVerification', v)} />
          </div>
          {local.captchaVerification && (
            <div className="mt-4">
              <DiscordSelect
                type="role"
                guildId={guildId}
                label="Rôle après vérification captcha"
                value={(local as any).verifiedRoleId ?? ''}
                onChange={(id) => update('verifiedRoleId' as any, id || null)}
              />
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Mode urgence</h2>
          </div>
          <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">Activer le mode urgence</span>
              <p className="text-xs text-[var(--text-secondary)]">Verrouille le serveur en cas d&apos;attaque</p>
            </div>
            <Button
              variant={emergencyActive ? 'secondary' : 'danger'}
              size="sm"
              loading={emergencyLoading}
              onClick={async () => {
                setEmergencyLoading(true);
                setSaveError(null);
                try {
                  const enable = !emergencyActive;
                  await api.post(`/api/guilds/${guildId}/protection/emergency`, { enable });
                  setEmergencyActive(enable);
                } catch (e: any) {
                  setSaveError(e?.message || 'Erreur mode urgence');
                } finally {
                  setEmergencyLoading(false);
                }
              }}
            >
              {emergencyActive ? 'Désactiver' : 'Activer'}
            </Button>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-3">
            Le mode urgence restreint l&apos;accès à tous les salons et active toutes les protections.
          </p>
        </Card>
      </div>
      </PermissionGate>
    </motion.div>
  );
}
