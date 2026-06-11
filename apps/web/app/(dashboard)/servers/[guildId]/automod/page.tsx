'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Shield, AlertTriangle, History, Settings2 } from 'lucide-react';
import { Card, Toggle, Input, Button, Skeleton } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { api } from '@/lib/api';
import { DiscordSelect } from '@/components/DiscordSelect';
import { PermissionGate } from '@/components/PermissionGate';
import { ModuleToggle } from '@/components/ModuleToggle';
import { RuleBuilder } from '@/components/automod/RuleBuilder';
import { MultiSelect } from '@/components/automod/MultiSelect';
import { AutoModHistory } from '@/components/automod/AutoModHistory';
import { settingsToRules, rulesToSettings } from '@/lib/automod-rules';

type Tab = 'rules' | 'whitelist' | 'sanctions' | 'history';

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
  const [tab, setTab] = useState<Tab>('rules');

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

  useEffect(() => { load(); }, [guildId]);

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
    return (
      <motion.div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-[var(--radius)]" />
        ))}
      </motion.div>
    );
  }

  const whitelistRoles = parseList(settings.whitelistRoles);
  const whitelistChannels = parseList(settings.whitelistChannels);

  const rules = settingsToRules(settings);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'rules', label: 'Règles', icon: <Settings2 size={16} /> },
    { key: 'whitelist', label: 'Exemptions', icon: <Shield size={16} /> },
    { key: 'sanctions', label: 'Sanctions', icon: <AlertTriangle size={16} /> },
    { key: 'history', label: 'Historique', icon: <History size={16} /> },
  ];

  return (
    <PermissionGate permission="manageMessages">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
      <div className="mb-4">
        <ModuleToggle guildId={guildId} moduleKey="automod" label="Auto-Modération" />
      </div>

      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Shield size={22} /> Auto-Modération
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Détections automatiques et sanctions sur les messages.
        </p>
      </div>

      <div className="flex gap-1 border-b border-[var(--border-color)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer bg-transparent ${
              tab === t.key
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rules' && (
        <Card className="p-4">
          <RuleBuilder
            rules={rules}
            onChange={(updatedRules) => {
              const patch = rulesToSettings(updatedRules);
              setSettings({ ...settings, ...patch });
            }}
          />
        </Card>
      )}

      {tab === 'whitelist' && (
        <Card className="p-4 space-y-6">
          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Ces rôles et salons sont exemptés de toutes les règles d&apos;auto-modération.
              Les administrateurs sont toujours exemptés automatiquement.
            </p>
          </div>
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
        </Card>
      )}

      {tab === 'sanctions' && (
        <Card className="p-4 space-y-4">
          <div className="space-y-4">
            <Input
              label="Seuil d'infractions avant sanction"
              type="number"
              min={1}
              value={String(settings.autoSanctionThreshold ?? 3)}
              onChange={(e) => update('autoSanctionThreshold', Math.max(1, parseInt(e.target.value) || 3))}
            />
            <div className="flex items-center justify-between">
              <span className="text-sm">Avertissement</span>
              <Toggle checked={!!settings.warnEnabled} onChange={(v) => update('warnEnabled', v)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Mute</span>
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
              <span className="text-sm">Expulsion</span>
              <Toggle checked={!!settings.kickEnabled} onChange={(v) => update('kickEnabled', v)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Bannissement</span>
              <Toggle checked={!!settings.banEnabled} onChange={(v) => update('banEnabled', v)} />
            </div>
          </div>

          <hr className="border-[var(--border-color)]" />

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Escalade automatique des avertissements</h3>
            <Input
              label="Seuil d'avertissements → mute"
              type="number"
              min={1}
              value={settings.autoWarnMuteThreshold != null ? String(settings.autoWarnMuteThreshold) : ''}
              onChange={(e) => update('autoWarnMuteThreshold', e.target.value ? parseInt(e.target.value) : null)}
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
              onChange={(e) => update('autoWarnBanThreshold', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Désactivé"
            />
          </div>

          <DiscordSelect
            type="channel"
            guildId={guildId}
            label="Salon de logs"
            value={String(settings.logChannelId ?? '')}
            onChange={(id) => update('logChannelId', id || null)}
          />
        </Card>
      )}

      {tab === 'history' && (
        <AutoModHistory guildId={guildId} />
      )}

      {tab !== 'history' && (
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer'}
        </Button>
      )}
    </motion.div>
    </PermissionGate>
  );
}
