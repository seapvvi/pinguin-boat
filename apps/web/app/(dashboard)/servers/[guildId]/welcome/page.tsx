'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Image, Mail, LogOut, Eye, Palette, UserPlus, LogIn, Loader2, Check } from 'lucide-react';
import { Toggle, Input, Button, Badge } from '@pinguin/ui';
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
  const [, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [local, setLocal] = useState<WelcomeSettings | null>(null);
  const [autoroleCount, setAutoroleCount] = useState(0);

  const [welcomePreview, setWelcomePreview] = useState('');
  const [goodbyePreview, setGoodbyePreview] = useState('');

  const lastLocalRef = useRef<WelcomeSettings | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setIsFetching(true);
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

        const value = {
          ...defaultWelcome,
          ...w,
          dmWelcome: w.dmWelcome ?? w.welcomeDM ?? false,
          dmWelcomeMessage: w.dmWelcomeMessage ?? w.welcomeDMMessage ?? null,
        } as WelcomeSettings;

        setLocal(value);
        lastLocalRef.current = value;

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
      setIsFetching(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const [saveBtnState, setSaveBtnState] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleSave = async () => {
    if (!local) return;
    setSaveBtnState('loading');
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
      setSaveBtnState('success');
      setTimeout(() => setSaveBtnState('idle'), 2000);
    } catch (e) {
      setSaveBtnState('idle');
      setSaveError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
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
    const base = local ?? lastLocalRef.current;
    if (!base) return;
    const next = { ...base, ...patch } as WelcomeSettings;
    setLocal(next);
    lastLocalRef.current = next;
  };

  function FadeInSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }
  if (!local && !isFetching) {
    // Seulement au premier chargement, jamais pendant un re-fetch
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <PageLayout title="Bienvenue / Au revoir" description="…">
          <SectionCard title="Chargement…">
            <div className="space-y-3">
              <div className="h-6 bg-[var(--bg-surface-alt)] rounded-[var(--radius)] w-2/3 animate-pulse" />
              <div className="h-6 bg-[var(--bg-surface-alt)] rounded-[var(--radius)] w-full animate-pulse" />
              <div className="h-6 bg-[var(--bg-surface-alt)] rounded-[var(--radius)] w-5/6 animate-pulse" />
            </div>
          </SectionCard>
        </PageLayout>
      </motion.div>
    );
  }

  const displayLocal = local ?? lastLocalRef.current;


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
          actions={
            <motion.button
              type="button"
              onClick={handleSave}
              disabled={saveBtnState === 'loading'}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                border: '1px solid var(--accent)',
                borderRadius: 6,
                backgroundColor: saveBtnState === 'success' ? 'rgba(34,197,94,0.1)' : 'var(--accent)',
                color: saveBtnState === 'success' ? '#22c55e' : 'var(--bg-primary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: saveBtnState === 'loading' ? 'not-allowed' : 'pointer',
                opacity: saveBtnState === 'loading' ? 0.7 : 1,
                transition: 'background-color 0.2s, color 0.2s, opacity 0.2s',
              }}
            >
              {saveBtnState === 'loading' && <Loader2 size={14} className="animate-spin" />}
              {saveBtnState === 'success' && <Check size={14} />}
              {saveBtnState === 'idle' && 'Enregistrer'}
              {saveBtnState === 'loading' && 'Enregistrement…'}
              {saveBtnState === 'success' && 'Sauvegardé !'}
            </motion.button>
          }
        >
          {saveError && (
            <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 px-3 py-2 mb-4">{saveError}</div>
          )}

          <FadeInSection>
            <div className="mb-4">
              <ModuleToggle guildId={guildId} moduleKey="welcome" label="Bienvenue" />
            </div>
          </FadeInSection>

          <FadeInSection delay={0.05}>
          <SectionCard
            title="Carte de bienvenue"
            icon={<Palette size={16} />}
            headerAction={
              <Toggle checked={!!displayLocal?.cardEnabled} onChange={(v) => {
                const base = local ?? displayLocal;
                if (!base) return;
                const next = { ...base, cardEnabled: v } as WelcomeSettings;
                setLocal(next);
                lastLocalRef.current = next;
              }} />
            }
          >
            {displayLocal?.cardEnabled && (
              <WelcomeCardEditor
                settings={{
                  cardBackground: displayLocal?.cardBackground,
                  cardBgColor: displayLocal?.cardBgColor,
                  cardBgImage: displayLocal?.cardBgImage,
                  cardTextColor: displayLocal?.cardTextColor,
                  cardSubtextColor: displayLocal?.cardSubtextColor,
                  cardAccentColor: displayLocal?.cardAccentColor,
                  cardBlurBackground: displayLocal?.cardBlurBackground,
                  cardText: displayLocal?.cardText,
                  cardSubtext: displayLocal?.cardSubtext,
                }}
                onChange={updateCard}
              />
            )}
          </SectionCard>
          </FadeInSection>

          <ModuleGrid>
            <FadeInSection delay={0.1}>
              <SectionCard
                title="Canal de bienvenue"
                icon={<LogIn size={16} />}
                headerAction={
                  <Toggle
                    checked={!!displayLocal?.welcomeChannelId || !!displayLocal?.enabled}
                    onChange={(v) => {
                      const base = local ?? displayLocal;
                      if (!base) return;
                      if (!v) {
                        const next = { ...base, welcomeChannelId: null } as WelcomeSettings;
                        setLocal(next);
                        lastLocalRef.current = next;
                      }
                    }}
                  />
                }
              >
                <div className="space-y-4">
                  <DiscordSelect
                    type="channel"
                    guildId={guildId}
                    label="Salon de bienvenue"
                    value={displayLocal?.welcomeChannelId ?? ''}
                    onChange={(id) => {
                      const base = local ?? displayLocal;
                      if (!base) return;
                      const next = { ...base, welcomeChannelId: id || null } as WelcomeSettings;
                      setLocal(next);
                      lastLocalRef.current = next;
                    }}
                  />
                  <div>
                    <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Message</label>
                    <textarea
                      value={displayLocal?.welcomeMessage ?? ''}
                      onChange={(e) => {
                        const base = local ?? displayLocal;
                        if (!base) return;
                        const next = { ...base, welcomeMessage: e.target.value || null } as WelcomeSettings;
                        setLocal(next);
                        lastLocalRef.current = next;
                        updatePreview(e.target.value);
                      }}
                      placeholder="Bienvenue {user} sur {server} !"
                      className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] outline-none focus:border-[var(--accent)] transition-colors resize-none h-20"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {placeholders.map((p) => (
                      <span key={p.key} onClick={() => {
                        const current = displayLocal?.welcomeMessage ?? '';
                        const base = local ?? displayLocal;
                        if (!base) return;
                        const next = { ...base, welcomeMessage: current + ' ' + p.key } as WelcomeSettings;
                        setLocal(next);
                        lastLocalRef.current = next;
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
                    <Toggle checked={!!displayLocal?.dmWelcome} onChange={(v) => {
                      const base = local ?? displayLocal;
                      if (!base) return;
                      const next = { ...base, dmWelcome: v } as WelcomeSettings;
                      setLocal(next);
                      lastLocalRef.current = next;
                    }} />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]">
                    <div className="flex items-center gap-2">
                      <Image size={14} />
                      <span className="text-sm text-[var(--text-primary)]">Embed de bienvenue</span>
                    </div>
                    <Toggle checked={!!displayLocal?.welcomeEmbed} onChange={(v) => {
                      const base = local ?? displayLocal;
                      if (!base) return;
                      const next = { ...base, welcomeEmbed: v } as WelcomeSettings;
                      setLocal(next);
                      lastLocalRef.current = next;
                    }} />
                  </div>
                  <Input
                    label="URL de l'image"
                    value={displayLocal?.welcomeImageUrl ?? ''}
                    onChange={(e) => {
                      const base = local ?? displayLocal;
                      if (!base) return;
                      const next = { ...base, welcomeImageUrl: e.target.value || null } as WelcomeSettings;
                      setLocal(next);
                      lastLocalRef.current = next;
                    }}
                    placeholder="https://..."
                  />
                </div>
              </SectionCard>
            </FadeInSection>

            <FadeInSection delay={0.15}>
              <SectionCard
                title="Canal de départ"
                icon={<LogOut size={16} />}
                headerAction={
                  <Toggle
                    checked={!!displayLocal?.goodbyeChannelId || !!displayLocal?.enabled}
                    onChange={(v) => {
                      const base = local ?? displayLocal;
                      if (!base) return;
                      if (!v) {
                        const next = { ...base, goodbyeChannelId: null } as WelcomeSettings;
                        setLocal(next);
                        lastLocalRef.current = next;
                      }
                    }}
                  />
                }
              >
                <div className="space-y-4">
                  <DiscordSelect
                    type="channel"
                    guildId={guildId}
                    label="Salon de départ"
                    value={displayLocal?.goodbyeChannelId ?? ''}
                    onChange={(id) => {
                      const base = local ?? displayLocal;
                      if (!base) return;
                      const next = { ...base, goodbyeChannelId: id || null } as WelcomeSettings;
                      setLocal(next);
                      lastLocalRef.current = next;
                    }}
                  />
                  <div>
                    <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Message</label>
                    <textarea
                      value={displayLocal?.goodbyeMessage ?? ''}
                      onChange={(e) => {
                        const base = local ?? displayLocal;
                        if (!base) return;
                        const next = { ...base, goodbyeMessage: e.target.value || null } as WelcomeSettings;
                        setLocal(next);
                        lastLocalRef.current = next;
                        updateGoodbyePreview(e.target.value);
                      }}
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
                    <Toggle checked={!!displayLocal?.goodbyeEmbed} onChange={(v) => {
                      const base = local ?? displayLocal;
                      if (!base) return;
                      const next = { ...base, goodbyeEmbed: v } as WelcomeSettings;
                      setLocal(next);
                      lastLocalRef.current = next;
                    }} />
                  </div>
                </div>
              </SectionCard>
            </FadeInSection>
            </ModuleGrid>

          <FadeInSection delay={0.2}>
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
          </FadeInSection>
        </PageLayout>
      </PermissionGate>
    </motion.div>
  );
}
