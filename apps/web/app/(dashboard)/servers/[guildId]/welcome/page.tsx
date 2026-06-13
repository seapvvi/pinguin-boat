'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Image, Mail, LogOut, Eye, Palette, UserPlus, LogIn } from 'lucide-react';
import { Toggle, Input, Button, Badge, Skeleton } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, api } from '@/lib/api';
import type { WelcomeSettings } from '@pinguin/shared';
import { ModuleToggle } from '@/components/ModuleToggle';
import { PermissionGate } from '@/components/PermissionGate';
import { DiscordSelect } from '@/components/DiscordSelect';
import WelcomeCardEditor from '@/components/welcome/WelcomeCardEditor';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';
import { ModuleGrid } from '@/components/layout/ModuleGrid';

export default function WelcomePage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [local, setLocal] = useState<WelcomeSettings | null>(null);
  const [autoroleCount, setAutoroleCount] = useState(0);

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
          cardEnabled: false,
          cardBackground: 'COLOR',
          cardBgColor: '#23272a',
          cardBgImage: null,
          cardTextColor: '#ffffff',
          cardSubtextColor: '#b9bbbe',
          cardAccentColor: '#5865f2',
          cardBlurBackground: false,
          cardText: 'Bienvenue sur {server} !',
          cardSubtext: 'Tu es le {memberCount}ème membre',
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

        const autoroles = res.data.guild.autoroles;
        if (autoroles?.roleIds) {
          setAutoroleCount(autoroles.roleIds.length);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

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
        cardEnabled: local.cardEnabled,
        cardBackground: local.cardBackground,
        cardBgColor: local.cardBgColor,
        cardBgImage: local.cardBgImage,
        cardTextColor: local.cardTextColor,
        cardSubtextColor: local.cardSubtextColor,
        cardAccentColor: local.cardAccentColor,
        cardBlurBackground: local.cardBlurBackground,
        cardText: local.cardText,
        cardSubtext: local.cardSubtext,
      });
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
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

  const updateCard = (patch: Partial<WelcomeSettings>) => {
    if (!local) return;
    setLocal({ ...local, ...patch });
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
          <Skeleton key={i} className="h-24 w-full" />
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
      <PermissionGate permission="manageGuild">
        <PageLayout
          title="Bienvenue / Au revoir"
          description="Personnalisez les messages d'accueil et de départ."
          actions={<Button loading={saving} onClick={handleSave}>Enregistrer</Button>}
        >
          {saveError && (
            <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 px-3 py-2 mb-4">{saveError}</div>
          )}

          <div className="mb-4">
            <ModuleToggle guildId={guildId} moduleKey="welcome" label="Bienvenue" />
          </div>

          <SectionCard
            title="Carte de bienvenue"
            icon={<Palette size={16} />}
            headerAction={
              <Toggle checked={local.cardEnabled} onChange={(v) => setLocal({ ...local, cardEnabled: v })} />
            }
          >
            {local.cardEnabled && (
              <WelcomeCardEditor
                settings={{
                  cardBackground: local.cardBackground,
                  cardBgColor: local.cardBgColor,
                  cardBgImage: local.cardBgImage,
                  cardTextColor: local.cardTextColor,
                  cardSubtextColor: local.cardSubtextColor,
                  cardAccentColor: local.cardAccentColor,
                  cardBlurBackground: local.cardBlurBackground,
                  cardText: local.cardText,
                  cardSubtext: local.cardSubtext,
                }}
                onChange={updateCard}
              />
            )}
          </SectionCard>

          <ModuleGrid>
              <SectionCard
                title="Canal de bienvenue"
                icon={<LogIn size={16} />}
                headerAction={
                  <Toggle
                    checked={!!local.welcomeChannelId || local.enabled}
                    onChange={(v) => {
                      if (!v) setLocal({ ...local, welcomeChannelId: null });
                    }}
                  />
                }
              >
                <div className="space-y-4">
                  <DiscordSelect
                    type="channel"
                    guildId={guildId}
                    label="Salon de bienvenue"
                    value={local.welcomeChannelId ?? ''}
                    onChange={(id) => setLocal({ ...local, welcomeChannelId: id || null })}
                  />
                  <div>
                    <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Message</label>
                    <textarea
                      value={local.welcomeMessage ?? ''}
                      onChange={(e) => { setLocal({ ...local, welcomeMessage: e.target.value || null }); updatePreview(e.target.value); }}
                      placeholder="Bienvenue {user} sur {server} !"
                      className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] outline-none focus:border-[var(--accent)] transition-colors resize-none h-20"
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
                  <div className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]">
                    <div className="flex items-center gap-2">
                      <Mail size={14} />
                      <span className="text-sm text-[var(--text-primary)]">MP de bienvenue</span>
                    </div>
                    <Toggle checked={local.dmWelcome} onChange={(v) => setLocal({ ...local, dmWelcome: v })} />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]">
                    <div className="flex items-center gap-2">
                      <Image size={14} />
                      <span className="text-sm text-[var(--text-primary)]">Embed de bienvenue</span>
                    </div>
                    <Toggle checked={local.welcomeEmbed} onChange={(v) => setLocal({ ...local, welcomeEmbed: v })} />
                  </div>
                  <Input
                    label="URL de l'image"
                    value={local.welcomeImageUrl ?? ''}
                    onChange={(e) => setLocal({ ...local, welcomeImageUrl: e.target.value || null })}
                    placeholder="https://..."
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Canal de départ"
                icon={<LogOut size={16} />}
                headerAction={
                  <Toggle
                    checked={!!local.goodbyeChannelId || local.enabled}
                    onChange={(v) => {
                      if (!v) setLocal({ ...local, goodbyeChannelId: null });
                    }}
                  />
                }
              >
                <div className="space-y-4">
                  <DiscordSelect
                    type="channel"
                    guildId={guildId}
                    label="Salon de départ"
                    value={local.goodbyeChannelId ?? ''}
                    onChange={(id) => setLocal({ ...local, goodbyeChannelId: id || null })}
                  />
                  <div>
                    <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Message</label>
                    <textarea
                      value={local.goodbyeMessage ?? ''}
                      onChange={(e) => { setLocal({ ...local, goodbyeMessage: e.target.value || null }); updateGoodbyePreview(e.target.value); }}
                      placeholder="Au revoir {user} !"
                      className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] outline-none focus:border-[var(--accent)] transition-colors resize-none h-20"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye size={14} className="text-[var(--text-secondary)]" />
                    <span className="text-xs text-[var(--text-secondary)]">Aperçu: {goodbyePreview || '(aucun message)'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]">
                    <div className="flex items-center gap-2">
                      <Image size={14} />
                      <span className="text-sm text-[var(--text-primary)]">Embed de départ</span>
                    </div>
                    <Toggle checked={local.goodbyeEmbed} onChange={(v) => setLocal({ ...local, goodbyeEmbed: v })} />
                  </div>
                </div>
              </SectionCard>
            </ModuleGrid>

          <SectionCard
              title="Autorôle à l'arrivée"
              icon={<UserPlus size={16} />}
            >
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                {autoroleCount > 0
                  ? `${autoroleCount} rôle(s) attribué(s) à l'arrivée`
                  : 'Aucun rôle attribué à l\'arrivée'}
              </p>
              <Link href={`/servers/${guildId}/autoroles`}>
                <Button variant="secondary" size="sm">Configurer dans Autorôles →</Button>
              </Link>
            </SectionCard>
        </PageLayout>
      </PermissionGate>
    </motion.div>
  );
}
