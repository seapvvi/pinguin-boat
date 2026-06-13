'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Shield, AlertTriangle } from 'lucide-react';
import { Toggle, Input, Button } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { api } from '@/lib/api';
import { DiscordSelect } from '@/components/DiscordSelect';
import { PermissionGate } from '@/components/PermissionGate';
import { ModuleToggle } from '@/components/ModuleToggle';
import { RuleBuilder } from '@/components/automod/RuleBuilder';
import { MultiSelect } from '@/components/automod/MultiSelect';
import { AutoModHistory } from '@/components/automod/AutoModHistory';
import { settingsToRules, rulesToSettings } from '@/lib/automod-rules';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';
import { ModuleGrid } from '@/components/layout/ModuleGrid';
import { SkeletonPage } from '@/components/layout/SkeletonPage';

function parseList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export default function AutoModPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bannedWordsText, setBannedWordsText] = useState('');
  const [forbiddenPingRolesText, setForbiddenPingRolesText] = useState('');
  const [forbiddenMarkdownListText, setForbiddenMarkdownListText] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Record<string, unknown> }>(`/api/guilds/${guildId}/automod`);
      if (res?.data) {
        setSettings(res.data);
        setBannedWordsText(parseList(res.data.bannedWordsList).join(', '));
        setForbiddenPingRolesText(parseList(res.data.forbiddenPingRoles).join(', '));
        setForbiddenMarkdownListText(parseList(res.data.forbiddenMarkdownList).join(', '));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [guildId]);

  const update = (key: string, value: unknown) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      const payload = {
        ...settings,
        bannedWordsList: bannedWordsText.split(',').map((s) => s.trim()).filter(Boolean),
        whitelistRoles: parseList(settings.whitelistRoles),
        whitelistChannels: parseList(settings.whitelistChannels),
        forbiddenPingRoles: forbiddenPingRolesText.split(',').map((s) => s.trim()).filter(Boolean),
        forbiddenMarkdownList: forbiddenMarkdownListText.split(',').map((s) => s.trim()).filter(Boolean),
      };
      await api.patch(`/api/guilds/${guildId}/automod`, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (error && !settings) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  if (loading || !settings) {
    return <SkeletonPage rows={3} />;
  }

  const whitelistRoles = parseList(settings.whitelistRoles);
  const whitelistChannels = parseList(settings.whitelistChannels);
  const rules = settingsToRules(settings);

  return (
    <PermissionGate permission="manageMessages">
      <PageLayout
        title="Auto-Modération"
        description="Détections automatiques et sanctions sur les messages."
        actions={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer'}
          </Button>
        }
      >
        <div className="mb-4">
          <ModuleToggle guildId={guildId} moduleKey="automod" label="Auto-Modération" />
        </div>

        <SectionCard title="Filtres actifs" description="Configurez les règles de détection automatique">
          <RuleBuilder
            rules={rules}
            onChange={(updatedRules) => {
              const patch = rulesToSettings(updatedRules);
              setSettings({ ...settings, ...patch });
            }}
          />
        </SectionCard>

        <div className="mt-6">
          <ModuleGrid>
            <SectionCard title="Sanctions" icon={<AlertTriangle size={16} />} expandable>
              <div className="space-y-4">
                <Input
                  label="Seuil d'infractions avant sanction"
                  type="number"
                  min={1}
                  value={String(settings.autoSanctionThreshold ?? 3)}
                  onChange={(e) =>
                    update('autoSanctionThreshold', Math.max(1, parseInt(e.target.value) || 3))
                  }
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-primary)]">Avertissement</span>
                  <Toggle checked={!!settings.warnEnabled} onChange={(v) => update('warnEnabled', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-primary)]">Mute</span>
                  <Toggle checked={!!settings.muteEnabled} onChange={(v) => update('muteEnabled', v)} />
                </div>
                {!!settings.muteEnabled && (
                  <Input
                    label="Durée mute (minutes)"
                    type="number"
                    min={1}
                    value={String(settings.muteDuration ?? 10)}
                    onChange={(e) => update('muteDuration', parseInt(e.target.value) || 10)}
                  />
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-primary)]">Expulsion</span>
                  <Toggle checked={!!settings.kickEnabled} onChange={(v) => update('kickEnabled', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-primary)]">Bannissement</span>
                  <Toggle checked={!!settings.banEnabled} onChange={(v) => update('banEnabled', v)} />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                  Escalade automatique des avertissements
                </h3>
                <div className="space-y-4">
                  <Input
                    label="Seuil d'avertissements → mute"
                    type="number"
                    min={1}
                    value={settings.autoWarnMuteThreshold != null ? String(settings.autoWarnMuteThreshold) : ''}
                    onChange={(e) =>
                      update(
                        'autoWarnMuteThreshold',
                        e.target.value ? parseInt(e.target.value) : null,
                      )
                    }
                    placeholder="Désactivé"
                  />
                  {settings.autoWarnMuteThreshold != null && (
                    <Input
                      label="Durée du mute automatique (minutes)"
                      type="number"
                      min={1}
                      value={String(settings.autoWarnMuteDuration ?? 60)}
                      onChange={(e) => update('autoWarnMuteDuration', parseInt(e.target.value) || 60)}
                    />
                  )}
                  <Input
                    label="Seuil d'avertissements → bannissement"
                    type="number"
                    min={1}
                    value={settings.autoWarnBanThreshold != null ? String(settings.autoWarnBanThreshold) : ''}
                    onChange={(e) =>
                      update(
                        'autoWarnBanThreshold',
                        e.target.value ? parseInt(e.target.value) : null,
                      )
                    }
                    placeholder="Désactivé"
                  />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                <DiscordSelect
                  type="channel"
                  guildId={guildId}
                  label="Salon de logs"
                  value={String(settings.logChannelId ?? '')}
                  onChange={(id) => update('logChannelId', id || null)}
                />
              </div>
            </SectionCard>

            <SectionCard title="Mots & comportements" icon={<Shield size={16} />} expandable>
              <div className="space-y-4">
                <Input
                  label="Mots interdits"
                  value={bannedWordsText}
                  onChange={(e) => setBannedWordsText(e.target.value)}
                  placeholder="séparés par des virgules"
                  helperText="Liste de mots interdits dans les messages"
                />
                <Input
                  label="Rôles interdits de ping"
                  value={forbiddenPingRolesText}
                  onChange={(e) => setForbiddenPingRolesText(e.target.value)}
                  placeholder="IDs de rôles séparés par des virgules"
                />
                <Input
                  label="Markdown interdit"
                  value={forbiddenMarkdownListText}
                  onChange={(e) => setForbiddenMarkdownListText(e.target.value)}
                  placeholder="séparés par des virgules"
                  helperText="Types de formatage markdown à bloquer"
                />
              </div>
            </SectionCard>
          </ModuleGrid>
        </div>

        <div className="mt-6">
          <SectionCard
            title="Exemptions"
            description="Ces rôles et salons sont exemptés de toutes les règles d'auto-modération. Les administrateurs sont toujours exemptés automatiquement."
          >
            <ModuleGrid>
              <MultiSelect
                type="role"
                guildId={guildId}
                value={whitelistRoles}
                onChange={(ids) => update('whitelistRoles', JSON.stringify(ids))}
                label="Rôles exemptés"
                adminWarning
              />
              <MultiSelect
                type="channel"
                guildId={guildId}
                value={whitelistChannels}
                onChange={(ids) => update('whitelistChannels', JSON.stringify(ids))}
                label="Salons exemptés"
              />
            </ModuleGrid>
          </SectionCard>
        </div>

        <div className="mt-6">
          <AutoModHistory guildId={guildId} />
        </div>
      </PageLayout>
    </PermissionGate>
  );
}

