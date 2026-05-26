'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { DoorOpen, Image, Mail, LogOut, Eye } from 'lucide-react';
import { Card, Toggle, Input, Button, Badge, Skeleton } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, api } from '@/lib/api';
import type { WelcomeSettings } from '@pinguin/shared';
import { ModuleToggle } from '@/components/ModuleToggle';
import { PermissionGate } from '@/components/PermissionGate';
import { DiscordSelect } from '@/components/DiscordSelect';
import { useAutoSave } from '@/lib/hooks';

export default function WelcomePage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [local, setLocal] = useState<WelcomeSettings | null>(null);
  // Les couleurs d’embed ne sont pas (actuellement) stockées dans `WelcomeSettings`.
  // Elles sont donc retirées pour éviter d’envoyer des champs non supportés au backend.

  const [welcomePreview, setWelcomePreview] = useState('');
  const [goodbyePreview, setGoodbyePreview] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGuildSettings(guildId);
      if (res.success && res.data) {
        const defaultWelcome: WelcomeSettings = {
          enabled: true,
          welcomeChannelId: null,
          welcomeMessage: 'Bienvenue {user} sur {server} !',
          welcomeEmbed: false,
          dmWelcome: false,
          dmWelcomeMessage: null,
          welcomeImageUrl: null,

          goodbyeChannelId: null,
          goodbyeMessage: 'Au revoir {user} !',
          goodbyeEmbed: false,
        };


        const w = (res.data.guild.welcome ?? defaultWelcome) as WelcomeSettings & {
          welcomeDM?: boolean;
          welcomeDMMessage?: string | null;
        };
        setLocal({
          ...defaultWelcome,
          ...w,
          dmWelcome: w.dmWelcome ?? w.welcomeDM ?? false,
          dmWelcomeMessage: w.dmWelcomeMessage ?? w.welcomeDMMessage ?? null,
        });

        setWelcomePreview(((w as WelcomeSettings).welcomeMessage || '').replace('{user}', '@utilisateur').replace('{server}', 'Nom du serveur').replace('{count}', '42'));
        setGoodbyePreview(((w as WelcomeSettings).goodbyeMessage || '').replace('{user}', '@utilisateur').replace('{server}', 'Nom du serveur').replace('{count}', '42'));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const saveWelcome = async (data: WelcomeSettings) => {
    await api.put(`/api/guilds/${guildId}/welcome`, {
      enabled: data.enabled,
      welcomeChannelId: data.welcomeChannelId,
      welcomeMessage: data.welcomeMessage,
      welcomeEmbed: data.welcomeEmbed,
      goodbyeChannelId: data.goodbyeChannelId,
      goodbyeMessage: data.goodbyeMessage,
      goodbyeEmbed: data.goodbyeEmbed,
      welcomeDM: data.dmWelcome,
      welcomeDMMessage: data.dmWelcomeMessage,
    });
  };

  useAutoSave(local, saveWelcome, { enabled: !!local });

  const handleSave = async () => {
    if (!local) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.put(`/api/guilds/${guildId}/welcome`, {
        enabled: local.enabled,
        welcomeChannelId: local.welcomeChannelId,
        welcomeMessage: local.welcomeMessage,
        welcomeEmbed: local.welcomeEmbed,
        goodbyeChannelId: local.goodbyeChannelId,
        goodbyeMessage: local.goodbyeMessage,
        goodbyeEmbed: local.goodbyeEmbed,
        welcomeDM: local.dmWelcome,
        welcomeDMMessage: local.dmWelcomeMessage,
      });
      await load();
    } catch (e: any) {
      setSaveError(e?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const previewReplace = (msg: string) => msg
    .replace(/\{user\}/gi, 'JeanDupont')
    .replace(/\{username\}/gi, 'jean_dupont')
    .replace(/\{server\}/gi, 'Nom du serveur')
    .replace(/\{members\}/gi, '42')
    .replace(/\{count\}/gi, '42')
    .replace(/\{inviter\}/gi, 'MarieInvite');

  const updatePreview = (msg: string) => {
    setWelcomePreview(previewReplace(msg));
  };

  const updateGoodbyePreview = (msg: string) => {
    setGoodbyePreview(previewReplace(msg));
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
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[var(--radius)]" />
        ))}
      </motion.div>
    );
  }

  const placeholders = [
    { key: '{user}', desc: 'Pseudo affiché (sans mention)' },
    { key: '{username}', desc: 'Nom d\'utilisateur Discord' },
    { key: '{server}', desc: 'Nom du serveur' },
    { key: '{members}', desc: 'Nombre de membres' },
    { key: '{count}', desc: 'Alias de {members}' },
    { key: '{inviter}', desc: 'Pseudo de l\'inviteur (sans mention)' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Bienvenue / Au revoir</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Personnalisez les messages d&apos;accueil et de départ.</p>
        </div>
        <Button loading={saving} onClick={handleSave}>Enregistrer</Button>
      </div>
      {saveError && <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] p-2 rounded mb-4">{saveError}</div>}

      <PermissionGate permission="manageGuild">
      <div className="mb-4">
        <ModuleToggle guildId={guildId} moduleKey="welcome" label="Bienvenue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Bienvenue</h2>
            <div className="space-y-4">
              <DiscordSelect type="channel" guildId={guildId} label="Salon de bienvenue" value={local.welcomeChannelId ?? ''} onChange={(id) => setLocal({ ...local, welcomeChannelId: id || null })} />
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Message</label>
                <textarea
                  value={local.welcomeMessage ?? ''}
                  onChange={(e) => { setLocal({ ...local, welcomeMessage: e.target.value || null }); updatePreview(e.target.value); }}
                  placeholder="Bienvenue {user} sur {server} !"
                  className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] transition-colors resize-none h-20"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {placeholders.map((p) => (
                  <span key={p.key} onClick={() => {
                    const current = local.welcomeMessage ?? '';
                    setLocal({ ...local, welcomeMessage: current + ' ' + p.key });
                    updatePreview(current + ' ' + p.key);
                  }} className="cursor-pointer inline-flex">
                    <Badge variant="info">
                      {p.key}: {p.desc}
                    </Badge>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-[var(--text-secondary)]" />
                <span className="text-xs text-[var(--text-secondary)]">Aperçu: {welcomePreview || '(aucun message)'}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                <div className="flex items-center gap-2">
                  <Mail size={14} />
                  <span className="text-sm text-[var(--text-primary)]">MP de bienvenue</span>
                </div>
                <Toggle checked={local.dmWelcome} onChange={(v) => setLocal({ ...local, dmWelcome: v })} />
              </div>
              {local.welcomeEmbed && (
                <div className="text-xs text-[var(--text-secondary)]">
                  L’édition des paramètres d’embed n’est pas (encore) gérée côté backend pour cette version.
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                <div className="flex items-center gap-2">
                  <Image size={14} />
                  <span className="text-sm text-[var(--text-primary)]">Embed de bienvenue</span>
                </div>
                <Toggle checked={local.welcomeEmbed} onChange={(v) => setLocal({ ...local, welcomeEmbed: v })} />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Image de bienvenue</h2>
            <Input label="URL de l&apos;image" value={local.welcomeImageUrl ?? ''} onChange={(e) => setLocal({ ...local, welcomeImageUrl: e.target.value || null })} placeholder="https://..." />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <LogOut size={18} className="text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Au revoir</h2>
            </div>
            <div className="space-y-4">
              <DiscordSelect type="channel" guildId={guildId} label="Salon de départ" value={local.goodbyeChannelId ?? ''} onChange={(id) => setLocal({ ...local, goodbyeChannelId: id || null })} />
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Message</label>
                <textarea
                  value={local.goodbyeMessage ?? ''}
                  onChange={(e) => { setLocal({ ...local, goodbyeMessage: e.target.value || null }); updateGoodbyePreview(e.target.value); }}
                  placeholder="Au revoir {user} !"
                  className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] transition-colors resize-none h-20"
                />
              </div>
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-[var(--text-secondary)]" />
                <span className="text-xs text-[var(--text-secondary)]">Aperçu: {goodbyePreview || '(aucun message)'}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                <div className="flex items-center gap-2">
                  <Image size={14} />
                  <span className="text-sm text-[var(--text-primary)]">Embed de départ</span>
                </div>
                <Toggle checked={local.goodbyeEmbed} onChange={(v) => setLocal({ ...local, goodbyeEmbed: v })} />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Aide — Variables disponibles</h2>
            <div className="space-y-2">
              {placeholders.map((p) => (
                <div key={p.key} className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                  <code className="text-xs text-[var(--accent)] font-mono">{p.key}</code>
                  <span className="text-xs text-[var(--text-secondary)]">{p.desc}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
      </PermissionGate>
    </motion.div>
  );
}
