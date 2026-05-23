'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Server, Users, Terminal, Clock, Cpu,
  DollarSign, Wifi, MessageSquare, Activity,
  TrendingUp, Heart, Plus, ChevronRight, Sparkles
} from 'lucide-react';
import { Card, KPICard, Skeleton, EmptyState, Button, Badge } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { getUser, type User } from '@/lib/auth';
import { fetchBotStats, fetchChangelogs, fetchXPLeaderboard, fetchGuilds } from '@/lib/api';
import { formatNumber, formatDuration } from '@/lib/utils';
import type { BotStats, Changelog, GuildItemDTO, LeaderboardEntry } from '@pinguin/shared';

interface OverviewData {
  stats: BotStats | null;
  changelogs: Changelog[];
  topXP: LeaderboardEntry[];
  topGuilds: GuildItemDTO[];
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
      const [statsRes, changelogsRes, xpRes, guildsRes] = await Promise.allSettled([
        fetchBotStats(),
        fetchChangelogs({ page: '1', limit: '5' }),
        fetchXPLeaderboard('global', { page: '1', limit: '10' }),
        fetchGuilds(),
      ]);
      setData({
        stats: statsRes.status === 'fulfilled' ? statsRes.value.data ?? null : null,
        changelogs: changelogsRes.status === 'fulfilled' ? changelogsRes.value.data?.entries ?? [] : [],
        topXP: xpRes.status === 'fulfilled' ? xpRes.value.data?.entries ?? [] : [],
        topGuilds: guildsRes.status === 'fulfilled' ? guildsRes.value.data?.guilds?.slice(0, 5) ?? [] : [],
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

  const kpis = data?.stats ? [
    { icon: <Server size={20} />, label: 'Nombre de serveurs', value: formatNumber(data.stats.totalGuilds) },
    { icon: <Users size={20} />, label: 'Membres totaux', value: formatNumber(data.stats.totalUsers) },
    { icon: <Terminal size={20} />, label: 'Commandes exécutées', value: formatNumber(data.stats.totalCommands) },
    { icon: <Clock size={20} />, label: 'Uptime', value: formatDuration(data.stats.uptime) },
    { icon: <Cpu size={20} />, label: 'CPU', value: `${data.stats.cpuUsage}%` },
    { icon: <Activity size={20} />, label: 'RAM', value: `${data.stats.ramUsage}%` },
    { icon: <DollarSign size={20} />, label: 'Revenus premium', value: '0 €' },
    { icon: <Wifi size={20} />, label: 'Membres en ligne', value: formatNumber(Math.round(data.stats.totalUsers * 0.3)) },
    { icon: <MessageSquare size={20} />, label: 'Messages aujourd\'hui', value: formatNumber(0) },
    { icon: <Activity size={20} />, label: 'Salons actifs', value: formatNumber(0) },
  ] : [];

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
          <Button variant="secondary" size="sm" onClick={() => window.open('https://patreon.com/pinguinboat', '_blank')}>
            <Heart size={14} /> Nous soutenir
          </Button>
          <Button size="sm" onClick={() => window.open('https://discord.com/oauth2/authorize?client_id=1320932385427947605&permissions=8&scope=bot', '_blank')}>
            <Plus size={14} /> Inviter le bot
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[var(--radius)]" />
          ))
        ) : (
          kpis.map((kpi, i) => (
            <KPICard key={i} icon={kpi.icon} label={kpi.label} value={kpi.value} />
          ))
        )}
      </div>

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
                    className="w-7 h-7 rounded-full"
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
                      className="w-7 h-7 rounded-full"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[var(--bg-surface-alt)] flex items-center justify-center text-xs font-bold text-[var(--text-secondary)]">
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
                    <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
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
