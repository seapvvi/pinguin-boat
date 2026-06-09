'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Hash, Shield, Scale, Activity,
  MessageSquare, Terminal, Music, Gift,
  Gamepad2, Star, ClipboardList, Users,
} from 'lucide-react';
import { Card, KPICard, Skeleton, Badge, Toggle } from '@pinguin/ui';
import { EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, fetchModCases, updateGuildSettings, fetchAuditLogs } from '@/lib/api';
import { formatNumber, formatDate } from '@/lib/utils';
import type { GuildConfig, ModCase } from '@pinguin/shared';
import { ModuleName } from '@pinguin/shared';
import { useOnboarding } from '@/hooks/useOnboarding';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';

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
  const [roleCount, setRoleCount] = useState<number>(0);
  const [recentActivity, setRecentActivity] = useState<{ id?: string; action?: string; createdAt?: string }[]>([]);

  const onboarding = useOnboarding(guildId);

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
        setRoleCount((guild as GuildConfig & { roleCount?: number }).roleCount ?? 0);
      }
      if (casesRes.success && casesRes.data) setCases(casesRes.data.cases ?? []);
      if (auditRes.success && auditRes.data) setRecentActivity(auditRes.data.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center gap-4 mb-6">
        {loading ? (
          <Skeleton className="w-12 h-12 rounded-[0px]" />
        ) : null}
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            {loading ? '...' : 'Aperçu du serveur'}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">ID: {guildId}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[var(--radius)]" />
          ))
        ) : (
          <>
            <KPICard icon={<Users size={20} />} label="Membres" value={formatNumber(memberCount || 0)} />
            <KPICard icon={<Hash size={20} />} label="Salons" value={String(channelCount || 0)} />
            <KPICard icon={<Shield size={20} />} label="Rôles" value={String(roleCount || 0)} />
            <KPICard icon={<Scale size={20} />} label="Cas de modération" value={formatNumber(cases.length)} />
            <KPICard icon={<Activity size={20} />} label="Activité" value={recentActivity.length > 0 ? 'Récente' : 'Aucune'} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Modules</h2>
          {toggleError && <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] p-2 rounded mb-4">{toggleError}</div>}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {modules.map((mod) => {
                const enabled = isModuleEnabled(mod.key);
                return (
                  <div key={mod.key} className="flex items-center justify-between py-2 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
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
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Cas de modération récents</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-[var(--radius-sm)]" />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <EmptyState title="Aucun cas" description="Aucune modération récente." />
          ) : (
            <div className="space-y-2">
              {cases.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-primary)]">{c.userId.slice(0, 8)}…</span>
                      <Badge variant={c.type === 'BAN' || c.type === 'KICK' ? 'error' : 'warning'}>{c.type}</Badge>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate max-w-[200px]">{c.reason}</p>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">{formatDate(c.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Activité récente</h2>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-sm)]" />
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <span className="text-xs text-[var(--text-secondary)]">Aucune activité récente.</span>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((act, i: number) => (
              <div key={act.id ?? i} className="flex items-center justify-between py-2 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-[var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-primary)]">{act.action ?? 'Action'}</span>
                </div>
                <span className="text-xs text-[var(--text-secondary)]">{act.createdAt ? formatDate(act.createdAt) : ''}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

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
    </motion.div>
  );
}
