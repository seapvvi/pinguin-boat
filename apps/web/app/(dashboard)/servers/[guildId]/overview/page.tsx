'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Shield, Scale, Activity,
  MessageSquare, Terminal, Music, Gift,
  Gamepad2, Star, ClipboardList, Users,
  Hash, Clock, Command,
} from 'lucide-react';
import { Badge, Toggle } from '@pinguin/ui';
import { EmptyState, ErrorMessage } from '@pinguin/ui';
import { SkeletonPage } from '@/components/layout/SkeletonPage';
import { fetchGuildSettings, fetchModCases, updateGuildSettings, fetchAuditLogs } from '@/lib/api';
import { formatNumber, formatDate } from '@/lib/utils';
import type { GuildConfig, ModCase } from '@pinguin/shared';
import { ModuleName } from '@pinguin/shared';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useCountUp } from '@/hooks/useCountUp';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { PageLayout, SectionCard, ModuleGrid } from '@/components/layout';

export default function GuildOverviewPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [cases, setCases] = useState<ModCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [channelCount, setChannelCount] = useState<number>(0);
  const [recentActivity, setRecentActivity] = useState<{ id?: string; action?: string; createdAt?: string }[]>([]);

  const onboarding = useOnboarding(guildId);

  const modules = [
    { key: ModuleName.MODERATION, label: 'Modération', icon: <Shield size={16} /> },
    { key: ModuleName.PROTECTION, label: 'Protection', icon: <Scale size={16} /> },
    { key: ModuleName.TICKETS, label: 'Tickets', icon: <MessageSquare size={16} /> },
    { key: ModuleName.LOGS, label: 'Logs', icon: <Terminal size={16} /> },
    { key: ModuleName.LEVELS, label: 'Niveaux', icon: <Activity size={16} /> },
    { key: ModuleName.ECONOMY, label: 'Économie', icon: <Activity size={16} /> },
    { key: ModuleName.MUSIC, label: 'Musique', icon: <Music size={16} /> },
    { key: ModuleName.GIVEAWAYS, label: 'Giveaways', icon: <Gift size={16} /> },
    { key: ModuleName.MINIGAMES, label: 'Minijeux', icon: <Gamepad2 size={16} /> },
    { key: ModuleName.STARBOARD, label: 'Starboard', icon: <Star size={16} /> },
    { key: ModuleName.FORMS, label: 'Formulaires', icon: <ClipboardList size={16} /> },
    { key: ModuleName.CLANS, label: 'Clans', icon: <Users size={16} /> },
  ];

  const skeletonRows = modules.length > 4 ? 3 : modules.length <= 2 ? 1 : 2;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, casesRes, auditRes] = await Promise.all([
        fetchGuildSettings(guildId),
        fetchModCases(guildId, { page: '1', limit: '5' }),
        fetchAuditLogs(guildId, { page: '1', limit: '10' }),
      ]);
      if (settingsRes.success && settingsRes.data) {
        const guild = settingsRes.data.guild;
        setConfig(guild);
        setMemberCount((guild as GuildConfig & { memberCount?: number }).memberCount ?? 0);
        setChannelCount((guild as GuildConfig & { channelCount?: number }).channelCount ?? 0);
      }
      if (casesRes.success && casesRes.data) setCases(casesRes.data.cases ?? []);
      if (auditRes.success && auditRes.data) setRecentActivity(auditRes.data.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [guildId]);

  useEffect(() => {
    if (!loading && config) {
      onboarding.checkOnboardingStatus();
    }
  }, [loading, config?.id]);

  const handleModuleToggle = async (module: ModuleName, enabled: boolean) => {
    setToggling(module);
    setToggleError(null);
    try {
      const current = config?.disabledModules ?? [];
      const updated = enabled
        ? current.filter((m) => m !== module)
        : [...current, module];
      const res = await updateGuildSettings(guildId, { disabledModules: updated });
      if (res.success && res.data) setConfig(res.data.guild);
    } catch (e) {
      setToggleError(e instanceof Error ? e.message : 'Erreur lors du changement de module');
    } finally {
      setToggling(null);
    }
  };

  const isModuleEnabled = (module: ModuleName) => !config?.disabledModules.includes(module);

  if (error) {
    return (
      <PageLayout title="Aperçu du serveur">
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </PageLayout>
    );
  }

  if (loading) {
    return <SkeletonPage rows={skeletonRows} />;
  }

  const animatedMembers = useCountUp(memberCount || 0, 700);
  const animatedChannels = useCountUp(channelCount || 0, 700);
  const animatedCases = useCountUp(cases.length || 0, 700);

  const statCards = [
    { icon: <Users size={24} />, value: formatNumber(animatedMembers), label: 'Membres' },
    { icon: <Hash size={24} />, value: formatNumber(animatedChannels), label: 'Salons' },
    { icon: <Command size={24} />, value: formatNumber(animatedCases), label: 'Cas de modération' },
    { icon: <Clock size={24} />, value: recentActivity.length > 0 ? 'Récente' : '—', label: 'Activité' },
  ].map((stat, i) => (
    <SectionCard key={i} title="">
      <div className="flex flex-col items-center py-4">
        <span className="text-[var(--text-secondary)] mb-2">{stat.icon}</span>
        <span className="text-3xl font-bold text-[var(--text-primary)]">{stat.value}</span>
        <span className="text-sm text-[var(--text-secondary)] mt-1">{stat.label}</span>
      </div>
    </SectionCard>
  ));

  return (
    <PageLayout title="Aperçu du serveur" description={`ID: ${guildId}`}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {statCards}
      </div>

      <ModuleGrid>
        <SectionCard title="Modules actifs">
          {toggleError && (
            <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 p-2 mb-3">{toggleError}</div>
          )}

          <div className="space-y-2">
            {modules.map((mod) => {
              const enabled = isModuleEnabled(mod.key);
              return (
                <div key={mod.key} className="flex items-center justify-between py-2 px-3 bg-[var(--bg-surface-alt)]">
                  <div className="flex items-center gap-2">
                    {mod.icon}
                    <span className="text-sm text-[var(--text-primary)]">{mod.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={enabled ? 'success' : 'error'}>{enabled ? 'Activé' : 'Désactivé'}</Badge>
                    <Toggle
                      checked={enabled}
                      onChange={(v) => handleModuleToggle(mod.key, v)}
                      disabled={toggling === mod.key}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Activité récente">
          {recentActivity.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">Aucune activité récente.</p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((act, i: number) => (
                <div
                  key={act.id ?? i}
                  className="flex items-center justify-between py-2 px-3 bg-[var(--bg-surface-alt)]"
                >
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-[var(--text-secondary)]" />
                    <span className="text-sm text-[var(--text-primary)]">{act.action ?? 'Action'}</span>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {act.createdAt ? formatDate(act.createdAt) : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </ModuleGrid>

      <SectionCard title="Cas de modération récents">
        {cases.length === 0 ? (
          <EmptyState title="Aucun cas" description="Aucune modération récente." />
        ) : (
          <div>
            <div className="grid grid-cols-4 gap-4 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
              <span>Utilisateur</span>
              <span>Type</span>
              <span>Raison</span>
              <span>Date</span>
            </div>
            {cases.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-4 gap-4 items-center py-2 px-3 bg-[var(--bg-surface-alt)] mt-1"
              >
                <span className="text-sm text-[var(--text-primary)] font-mono">{c.userId.slice(0, 8)}…</span>
                <Badge variant={c.type === 'BAN' || c.type === 'KICK' ? 'error' : 'warning'}>{c.type}</Badge>
                <span className="text-xs text-[var(--text-secondary)] truncate">{c.reason}</span>
                <span className="text-xs text-[var(--text-secondary)]">{formatDate(c.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <OnboardingModal
        guildId={guildId}
        open={onboarding.open}
        currentStep={onboarding.currentStep}
        totalSteps={onboarding.totalSteps}
        data={onboarding.data}
        onClose={onboarding.skipOnboarding}
        onSkip={onboarding.skipOnboarding}
        onComplete={onboarding.completeOnboarding}
        onStepChange={onboarding.setStep}
        onNextStep={onboarding.nextStep}
        onPrevStep={onboarding.prevStep}
      />
    </PageLayout>
  );
}

