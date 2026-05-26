'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Server, Users, Terminal, Clock, Cpu,
  DollarSign, Wifi, MessageSquare, Activity,
  TrendingUp, Heart, Plus, ChevronRight, Sparkles
} from 'lucide-react';
import { Card, KPICard, Skeleton, EmptyState, Badge } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { getUser, type User } from '@/lib/auth';
import { fetchBotStats, fetchChangelogs, fetchGuilds, api } from '@/lib/api';
import { InviteBotButton } from '@/components/InviteBotButton';
import { formatNumber, formatDuration } from '@/lib/utils';
import type { BotStats, Changelog, GuildItemDTO, LeaderboardEntry } from '@pinguin/shared';

interface Donor {
  id: string;
  username: string;
  amount: number;
  message: string | null;
}

interface OverviewData {
  stats: BotStats | null;
  changelogs: Changelog[];
  topXP: LeaderboardEntry[];
  topGuilds: GuildItemDTO[];
  donors: Donor[];
}

export default function OverviewPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const u = await getUser();
      setUser(u);
      if (!u) {
        router.replace('/auth/login');
        return;
      }
      const [statsRes, changelogsRes, guildsRes, donorsRes, lbRes] = await Promise.allSettled([
        fetchBotStats(),
        fetchChangelogs({ page: '1', limit: '5' }),
        fetchGuilds(),
        api.get<{ data: { donors: Donor[] } }>('/api/donors'),
        api.get<{ data: { entries: LeaderboardEntry[] } }>('/api/overview/leaderboard/global?limit=5'),
      ]);
      setData({
        stats: statsRes.status === 'fulfilled' ? statsRes.value.data ?? null : null,
        changelogs: changelogsRes.status === 'fulfilled' ? changelogsRes.value.data?.entries ?? [] : [],
        topXP: lbRes.status === 'fulfilled'
          ? (lbRes.value.data as { entries?: LeaderboardEntry[] })?.entries?.map((e: any) => ({
              userId: e.userId,
              username: e.username,
              avatar: e.avatar,
              xp: e.totalXp ?? e.xp ?? 0,
              level: e.level ?? 0,
            })) ?? []
          : [],
        topGuilds: guildsRes.status === 'fulfilled' ? guildsRes.value.data?.guilds?.slice(0, 5) ?? [] : [],
        donors: donorsRes.status === 'fulfilled' ? (donorsRes.value.data as { donors?: Donor[] })?.donors?.slice(0, 5) ?? [] : [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  const stats = data?.stats as (BotStats & {
    isOwner?: boolean;
    activeMembers?: number;
    onlineMembers?: number;
    activeChannels?: number;
  }) | null;

  const kpis = stats
    ? stats.isOwner === true
      ? [
          { icon: <Server size={20} />, label: 'Nombre de serveurs', value: formatNumber(stats.totalGuilds) },
          { icon: <Users size={20} />, label: 'Membres totaux', value: formatNumber(stats.totalUsers) },
          { icon: <Terminal size={20} />, label: 'Commandes exécutées', value: formatNumber(stats.totalCommands ?? 0) },
          { icon: <Clock size={20} />, label: 'Uptime', value: formatDuration(stats.uptime ?? 0) },
          { icon: <Cpu size={20} />, label: 'CPU', value: `${stats.cpuUsage ?? 0}%` },
          { icon: <Activity size={20} />, label: 'RAM', value: `${stats.ramUsage ?? 0}%` },
          { icon: <DollarSign size={20} />, label: 'Revenus premium', value: '0 €' },
          { icon: <Wifi size={20} />, label: 'Membres en ligne', value: formatNumber(stats.onlineMembers ?? 0) },
        ]
      : [
          { icon: <Server size={20} />, label: 'Nombre de serveurs', value: formatNumber(stats.totalGuilds) },
          { icon: <Users size={20} />, label: 'Membres totaux', value: formatNumber(stats.totalUsers) },
          { icon: <TrendingUp size={20} />, label: 'Membres actifs', value: formatNumber(stats.activeMembers ?? stats.onlineMembers ?? 0) },
          { icon: <MessageSquare size={20} />, label: 'Salons actifs', value: formatNumber(stats.activeChannels ?? 0) },
          { icon: <Wifi size={20} />, label: 'Membres en ligne', value: formatNumber(stats.onlineMembers ?? 0) },
        ]
    : [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            Bienvenue, {user?.username ?? '...'}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Voici un aperçu de votre écosystème Pinguin BOAT.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://patreon.com/pinguinboat"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-[var(--radius-sm)] transition-colors duration-150 border text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--bg-surface-alt)] no-underline cursor-pointer"
          >
            <Heart size={14} /> Nous soutenir
          </a>
          <InviteBotButton />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {loading ? (
          Array.from({ length: kpis.length || 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[var(--radius)]" />
          ))
        ) : (
          kpis.map((kpi, i) => (
            <KPICard key={i} icon={kpi.icon} label={kpi.label} value={kpi.value} />
          ))
        )}
      </div>

      {data && data.donors.length > 0 && (
        <Card className="mb-8 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Nos donateurs</h2>
            <Heart size={16} className="text-[var(--accent)]" />
          </div>
          <div className="flex flex-wrap gap-3">
            {data.donors.map((d) => (
              <div key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
                <span className="text-sm font-medium text-[var(--text-primary)]">{d.username}</span>
                <span className="text-xs text-[var(--text-secondary)]">{d.amount.toFixed(2)} €</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Classement XP global</h2>
            <TrendingUp size={16} className="text-[var(--text-secondary)]" />
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />
              ))}
            </div>
          ) : data?.topXP.length === 0 ? (
            <EmptyState title="Aucune donnée" description="Le classement XP est vide pour le moment." />
          ) : (
            <div className="space-y-1">
              {data?.topXP.map((entry, i) => (
                <div key={entry.userId} className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] hover:bg-[var(--bg-surface-alt)] transition-colors">
                  <span className="w-6 text-center text-xs font-bold text-[var(--text-secondary)]">#{i + 1}</span>
                  <img
                    src={`https://cdn.discordapp.com/avatars/${entry.userId}/${entry.avatar}.png?size=32`}
                    alt={entry.username}
                    className="w-7 h-7 rounded-[0px]"
                  />
                  <span className="flex-1 text-sm text-[var(--text-primary)] truncate">{entry.username}</span>
                  <span className="text-xs text-[var(--text-secondary)]">{entry.level} niveaux</span>
                  <span className="text-xs font-medium text-[var(--accent)]">{formatNumber(entry.xp)} XP</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Top serveurs</h2>
            <Server size={16} className="text-[var(--text-secondary)]" />
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />
              ))}
            </div>
          ) : data?.topGuilds.length === 0 ? (
            <EmptyState title="Aucun serveur" description="Aucun serveur trouvé." />
          ) : (
            <div className="space-y-1">
              {data?.topGuilds.map((g) => (
                <div key={g.id} className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] hover:bg-[var(--bg-surface-alt)] transition-colors">
                  {g.icon ? (
                    <img
                      src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=32`}
                      alt={g.name}
                      className="w-7 h-7 rounded-[0px]"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-[0px] bg-[var(--bg-surface-alt)] flex items-center justify-center text-xs font-bold text-[var(--text-secondary)]">
                      {g.name.charAt(0)}
                    </div>
                  )}
                  <span className="flex-1 text-sm text-[var(--text-primary)] truncate">{g.name}</span>
                  <Badge variant={g.botPresent ? 'success' : 'warning'}>
                    {g.botPresent ? 'Présent' : 'Absent'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Derniers changelogs</h2>
            <Sparkles size={16} className="text-[var(--text-secondary)]" />
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-[var(--radius-sm)]" />
              ))}
            </div>
          ) : data?.changelogs.length === 0 ? (
            <EmptyState title="Aucun changelog" description="Aucune mise à jour récente." />
          ) : (
            <div className="space-y-3">
              {data?.changelogs.map((cl) => (
                <div key={cl.id} className="pb-3 border-b border-[var(--border-color)] last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{cl.title}</span>
                    <Badge variant="info">{cl.version}</Badge>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{cl.content}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">État des systèmes</h2>
            <Activity size={16} className="text-[var(--text-secondary)]" />
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'API', status: 'Opérationnel' },
                { label: 'Base de données', status: 'Opérationnel' },
                { label: 'File d\'attente', status: 'Opérationnel' },
                { label: 'Cache', status: 'Opérationnel' },
                { label: 'Lecteur musique', status: 'Opérationnel' },
              ].map((sys) => (
                <div key={sys.label} className="flex items-center justify-between py-2 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                  <span className="text-sm text-[var(--text-primary)]">{sys.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-[0px] bg-[var(--success)]" />
                    <span className="text-xs text-[var(--success)]">{sys.status}</span>
                  </div>
                </div>
              ))}
              <p className="text-xs text-[var(--text-secondary)] mt-3 text-center">
                Tous les systèmes sont opérationnels. Mode alpha — aucune facturation.
              </p>
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
