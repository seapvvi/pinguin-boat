'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Server, Search, Plus, Users } from 'lucide-react';
import { Input, Badge, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuilds, api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { useConfetti } from '@/hooks/useConfetti';
import type { GuildItemDTO } from '@pinguin/shared';

export default function ServersPage() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/overview';
  const [guilds, setGuilds] = useState<GuildItemDTO[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { fire } = useConfetti();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGuilds();
      if (res.success && res.data) {
        setGuilds(res.data.guilds);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = guilds.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  if (error) {
    return (
      <div className="p-6">
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Sélecteur de serveur</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Choisissez un serveur pour gérer sa configuration.
          </p>
        </div>
        <Input
          placeholder="Rechercher un serveur…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-[var(--radius)]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search size={32} />}
          title="Aucun serveur trouvé"
          description={search ? 'Essayez un autre terme de recherche.' : 'Aucun serveur disponible.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((g) => (
            <div
              key={g.id}
              className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[var(--radius)] p-5 transition-colors duration-200"
            >
              <div className="flex items-center gap-3 mb-3">
                {g.icon ? (
                  <img
                    src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64`}
                    alt={g.name}
                    className="w-10 h-10 rounded-[0px]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-[0px] bg-[var(--bg-surface-alt)] flex items-center justify-center text-base font-bold text-[var(--text-secondary)]">
                    {g.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{g.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant={g.botPresent ? 'success' : 'warning'}>
                      {g.botPresent ? 'Présent' : 'Absent'}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                <span className="flex items-center gap-1">
                  <Users size={12} /> {formatNumber(g.memberCount)}
                </span>
                <span className="flex items-center gap-1">
                  <Server size={12} /> {g.premium !== 'FREE' ? 'Premium' : 'Gratuit'}
                </span>
              </div>
              {g.botPresent ? (
                <a
                  href={`/servers/${g.id}${redirect}`}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-colors duration-150 border bg-[var(--accent)] text-[var(--bg-primary)] border-[var(--accent)] hover:opacity-90 no-underline"
                >
                  Gérer
                </a>
              ) : (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      fire('invite');
                      api.get<{ data: { url: string } }>(`/api/bot/invite?guild_id=${g.id}`).then((res) => {
                        const u = (res as { data?: { url: string } }).data?.url;
                        if (u) window.open(u, '_blank');
                      });
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-colors duration-150 border text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--bg-surface-alt)] no-underline"
                  >
                    <Plus size={12} /> Inviter
                  </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
