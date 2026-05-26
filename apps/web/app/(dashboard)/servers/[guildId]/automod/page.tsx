'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Shield, AlertTriangle } from 'lucide-react';
import { Card, Toggle, Input, Button, Skeleton } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { api } from '@/lib/api';
import { DiscordSelect } from '@/components/DiscordSelect';
import { useAutoSave } from '@/lib/hooks';

type AutoModSettings = Record<string, unknown>;

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
  const [settings, setSettings] = useState<AutoModSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bannedWordsText, setBannedWordsText] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: AutoModSettings }>(`/api/guilds/${guildId}/automod`);
      if (res.success && res.data) {
        setSettings(res.data);
        setBannedWordsText(parseList(res.data.bannedWordsList).join(', '));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const saveAutomod = async (s: AutoModSettings) => {
    const payload = {
      ...s,
      bannedWordsList: bannedWordsText.split(',').map((x) => x.trim()).filter(Boolean),
      whitelistRoles: parseList(s.whitelistRoles),
      whitelistChannels: parseList(s.whitelistChannels),
      forbiddenPingRoles: parseList(s.forbiddenPingRoles),
      forbiddenMarkdownList: parseList(s.forbiddenMarkdownList),
    };
    await api.patch(`/api/guilds/${guildId}/automod`, payload);
  };

  useAutoSave(settings, saveAutomod, { enabled: !!settings });

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
        forbiddenPingRoles: parseList(settings.forbiddenPingRoles),
        forbiddenMarkdownList: parseList(settings.forbiddenMarkdownList),
      };
      await api.patch(`/api/guilds/${guildId}/automod`, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la sauvegarde');
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

  const bool = (k: string) => !!settings[k];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Shield size={22} /> Auto-Modération
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Détections automatiques et sanctions sur les messages.
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <h2 className="font-medium text-[var(--text-primary)]">Détection d&apos;infractions</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm">Mots interdits</span>
          <Toggle checked={bool('bannedWords')} onChange={(v) => update('bannedWords', v)} />
        </div>
        {bool('bannedWords') && (
          <Input
            label="Liste (séparés par des virgules)"
            value={bannedWordsText}
            onChange={(e) => setBannedWordsText(e.target.value)}
          />
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm">Invitations Discord</span>
          <Toggle checked={bool('discordInvites')} onChange={(v) => update('discordInvites', v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Liens externes</span>
          <Toggle checked={bool('externalLinks')} onChange={(v) => update('externalLinks', v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Majuscules excessives</span>
          <Toggle checked={bool('excessiveCaps')} onChange={(v) => update('excessiveCaps', v)} />
        </div>
        {bool('excessiveCaps') && (
          <Input
            label="Seuil (%)"
            type="number"
            value={String(settings.capsThreshold ?? 70)}
            onChange={(e) => update('capsThreshold', parseInt(e.target.value) || 70)}
          />
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm">Spam de messages</span>
          <Toggle checked={bool('messageSpam')} onChange={(v) => update('messageSpam', v)} />
        </div>
        {bool('messageSpam') && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Messages max"
              type="number"
              value={String(settings.spamThreshold ?? 5)}
              onChange={(e) => update('spamThreshold', parseInt(e.target.value) || 5)}
            />
            <Input
              label="Intervalle (s)"
              type="number"
              value={String(settings.spamInterval ?? 5)}
              onChange={(e) => update('spamInterval', parseInt(e.target.value) || 5)}
            />
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-medium text-[var(--text-primary)] flex items-center gap-2">
          <AlertTriangle size={16} /> Sanctions automatiques
        </h2>
        <Input
          label="Seuil d'infractions avant sanction"
          type="number"
          value={String(settings.autoSanctionThreshold ?? 3)}
          onChange={(e) => update('autoSanctionThreshold', parseInt(e.target.value) || 3)}
        />
        <div className="flex items-center justify-between">
          <span className="text-sm">Avertissement</span>
          <Toggle checked={bool('warnEnabled')} onChange={(v) => update('warnEnabled', v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Mute</span>
          <Toggle checked={bool('muteEnabled')} onChange={(v) => update('muteEnabled', v)} />
        </div>
        {bool('muteEnabled') && (
          <Input
            label="Durée mute (minutes)"
            type="number"
            value={String(settings.muteDuration ?? 10)}
            onChange={(e) => update('muteDuration', parseInt(e.target.value) || 10)}
          />
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm">Expulsion</span>
          <Toggle checked={bool('kickEnabled')} onChange={(v) => update('kickEnabled', v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Bannissement</span>
          <Toggle checked={bool('banEnabled')} onChange={(v) => update('banEnabled', v)} />
        </div>
        <DiscordSelect
          type="channel"
          guildId={guildId}
          label="Salon de logs"
          value={String(settings.logChannelId ?? '')}
          onChange={(id) => update('logChannelId', id || null)}
        />
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer'}
      </Button>
    </motion.div>
  );
}
