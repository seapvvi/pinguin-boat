'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Swords, MessageSquare, Hash, Users, Sliders, AlertTriangle } from 'lucide-react';
import { Toggle, Input, Select, Button, Skeleton } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, api } from '@/lib/api';
import type { ProtectionSettings } from '@pinguin/shared';
import { ModuleToggle } from '@/components/ModuleToggle';
import { PermissionGate } from '@/components/PermissionGate';
import { DiscordSelect } from '@/components/DiscordSelect';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';
import { ModuleGrid } from '@/components/layout/ModuleGrid';

export default function ProtectionPage() {
  const { guildId } = useParams<{ guildId: string }>();
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

  const update = (key: keyof ProtectionSettings, value: unknown) => {
    if (!local) return;
    setLocal({ ...local, [key]: value });
  };

  const handleSave = async () => {
    if (!local) return;
    setSaving(true);
    setSaveError(null);
    try {
      const enabled =
        local.antiRaid ||
        local.antiSpam ||
        local.antiMassMention ||
        local.antiLink ||
        local.antiAlts ||
        local.captchaVerification ||
        emergencyActive;
      await api.put(`/api/guilds/${guildId}/protection`, { ...local, enabled });
      await load();
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
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <PermissionGate permission="manageGuild">
        <PageLayout
          title="Protection / Anti-raid"
          description="Protégez votre serveur contre les raids et les abus."
          actions={
            <Button loading={saving} onClick={handleSave}>Enregistrer</Button>
          }
        >
          {saveError && (
            <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 px-3 py-2 mb-4">{saveError}</div>
          )}

          <div className="mb-4">
            <ModuleToggle guildId={guildId} moduleKey="protection" label="Protection" />
          </div>

          <ModuleGrid>
            <SectionCard
              title="Anti-raid"
              icon={<Swords size={16} />}
              headerAction={<Toggle checked={local.antiRaid} onChange={(v) => update('antiRaid', v)} />}
              expandable
              accent={local.antiRaid ? '#ef4444' : undefined}
            >
              <div className="space-y-4">
                <Input label="Seuil de raid (joins/minute)" type="number" value={String(local.raidThreshold)} onChange={(e) => update('raidThreshold', Number(e.target.value))} />
                <Input label="Intervalle de raid (secondes)" type="number" value={String(local.raidInterval)} onChange={(e) => update('raidInterval', Number(e.target.value))} />
              </div>
            </SectionCard>

            <SectionCard
              title="Anti-spam"
              icon={<MessageSquare size={16} />}
              headerAction={<Toggle checked={local.antiSpam} onChange={(v) => update('antiSpam', v)} />}
              expandable
              accent={local.antiSpam ? '#ef4444' : undefined}
            >
              <div className="space-y-4">
                <Input label="Seuil de spam (messages/seconde)" type="number" value={String(local.spamThreshold)} onChange={(e) => update('spamThreshold', Number(e.target.value))} />
                <Input label="Intervalle de spam (secondes)" type="number" value={String(local.spamInterval)} onChange={(e) => update('spamInterval', Number(e.target.value))} />
              </div>
            </SectionCard>

            <SectionCard
              title="Anti-mass mention"
              icon={<Hash size={16} />}
              headerAction={<Toggle checked={local.antiMassMention} onChange={(v) => update('antiMassMention', v)} />}
              expandable
              accent={local.antiMassMention ? '#ef4444' : undefined}
            >
              <Input label="Seuil de mentions" type="number" value={String(local.mentionThreshold)} onChange={(e) => update('mentionThreshold', Number(e.target.value))} />
            </SectionCard>

            <SectionCard
              title="Anti-liens"
              icon={<Hash size={16} />}
              headerAction={<Toggle checked={local.antiLink} onChange={(v) => update('antiLink', v)} />}
              expandable
              accent={local.antiLink ? '#ef4444' : undefined}
            >
              <p className="text-xs text-[var(--text-secondary)]">Bloque les liens dans les messages.</p>
            </SectionCard>

            <SectionCard
              title="Anti-alts"
              icon={<Users size={16} />}
              headerAction={<Toggle checked={local.antiAlts} onChange={(v) => update('antiAlts', v)} />}
              expandable
              accent={local.antiAlts ? '#ef4444' : undefined}
            >
              <Input label="Âge min. du compte (jours)" type="number" value={String(local.altAccountAge)} onChange={(e) => update('altAccountAge', Number(e.target.value))} />
            </SectionCard>

            <SectionCard
              title="Niveau de vérification"
              icon={<Sliders size={16} />}
              expandable
            >
              <div className="space-y-4">
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
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-[var(--text-primary)]">Vérification par Captcha</span>
                    <p className="text-xs text-[var(--text-secondary)]">Oblige un captcha à l&apos;arrivée</p>
                  </div>
                  <Toggle checked={local.captchaVerification} onChange={(v) => update('captchaVerification', v)} />
                </div>
                {local.captchaVerification && (
                  <DiscordSelect
                    type="role"
                    guildId={guildId}
                    label="Rôle après vérification captcha"
                    value={local.verifiedRoleId ?? ''}
                    onChange={(id) => update('verifiedRoleId', id || null)}
                  />
                )}
              </div>
            </SectionCard>
          </ModuleGrid>

          <div className="mt-6">
            <SectionCard
              title="Mode urgence"
              icon={<AlertTriangle size={16} />}
              description="Verrouille le serveur en cas d'attaque"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {emergencyActive ? 'Mode urgence activé' : 'Activer le mode urgence'}
                  </span>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Le mode urgence restreint l&apos;accès à tous les salons et active toutes les protections.
                  </p>
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
                    } catch (e) {
                      setSaveError(e instanceof Error ? e.message : 'Erreur mode urgence');
                    } finally {
                      setEmergencyLoading(false);
                    }
                  }}
                >
                  {emergencyActive ? 'Désactiver' : 'Activer'}
                </Button>
              </div>
            </SectionCard>
          </div>
        </PageLayout>
      </PermissionGate>
    </motion.div>
  );
}
