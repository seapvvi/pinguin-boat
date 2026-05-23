'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Users, Hash, Shield, Scale, Activity,
  MessageSquare, Terminal, Music, Gift, Check, X
} from 'lucide-react';
import { Card, KPICard, Skeleton, Badge, Toggle } from '@pinguin/ui';
import { EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, fetchModCases, updateGuildSettings } from '@/lib/api';
import { formatNumber, formatDate } from '@/lib/utils';
import type { GuildConfig, ModCase } from '@pinguin/shared';
import { ModuleName } from '@pinguin/shared';

export default function GuildOverviewPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [cases, setCases] = useState<ModCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, casesRes] = await Promise.all([
        fetchGuildSettings(guildId),
        fetchModCases(guildId, { page: '1', limit: '5' }),
      ]);
      if (settingsRes.success && settingsRes.data) setConfig(settingsRes.data.guild);
      if (casesRes.success && casesRes.data) setCases(casesRes.data.cases);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const handleModuleToggle = async (module: ModuleName, enabled: boolean) => {
    setToggling(module);
    try {
      const current = config?.disabledModules ?? [];
      const updated = enabled
        ? current.filter((m) => m !== module)
        : [...current, module];
      const res = await updateGuildSettings(guildId, { disabledModules: updated });
      if (res.success && res.data) setConfig(res.data.guild);
    } catch { /* ignore */ } finally {
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
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center gap-4 mb-6">
        {loading ? (
          <Skeleton className="w-12 h-12 rounded-full" />
        ) : (
          <img
            src={`https://cdn.discordapp.com/icons/${guildId}/${config?.guildId}.png?size=64`}
            alt=""
            className="w-12 h-12 rounded-full bg-[var(--bg-surface-alt)]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
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
            <KPICard icon={<Users size={20} />} label="Membres" value={formatNumber(250)} />
            <KPICard icon={<Hash size={20} />} label="Salons" value="12" />
            <KPICard icon={<Shield size={20} />} label="Rôles" value="8" />
            <KPICard icon={<Scale size={20} />} label="Cas de modération" value={formatNumber(cases.length)} />
            <KPICard icon={<Activity size={20} />} label="Activité" value="Élevée" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Modules</h2>
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
        ) : (
          <div className="space-y-2">
            {[
              { action: 'Message supprimé', user: '123456', time: '2 min' },
              { action: 'Membre rejoint', user: '789012', time: '5 min' },
              { action: 'Cas de modération créé', user: '345678', time: '10 min' },
              { action: 'Salon créé', user: 'Système', time: '15 min' },
            ].map((act, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-[var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-primary)]">{act.action}</span>
                </div>
                <span className="text-xs text-[var(--text-secondary)]">Il y a {act.time}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
