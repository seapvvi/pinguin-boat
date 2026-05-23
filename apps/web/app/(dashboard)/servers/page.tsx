'use client';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Server, Search, Plus, Users, Wifi } from 'lucide-react';
import { Card, Input, Button, Badge, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuilds } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import type { GuildItemDTO } from '@pinguin/shared';

export default function ServersPage() {
  const router = useRouter();
  const [guilds, setGuilds] = useState<GuildItemDTO[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Sélecteur de serveur</h1>
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
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[var(--radius)] p-5 cursor-pointer hover:border-[var(--accent)] transition-colors duration-200"
              onClick={() => router.push(`/servers/${g.id}/overview`)}
            >
              <div className="flex items-center gap-3 mb-3">
                {g.icon ? (
                  <img
                    src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64`}
                    alt={g.name}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--bg-surface-alt)] flex items-center justify-center text-base font-bold text-[var(--text-secondary)]">
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
              {!g.botPresent && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(
                      `https://discord.com/oauth2/authorize?client_id=1320932385427947605&permissions=8&scope=bot&guild_id=${g.id}`,
                      '_blank'
                    );
                  }}
                >
                  <Plus size={12} /> Inviter
                </Button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
