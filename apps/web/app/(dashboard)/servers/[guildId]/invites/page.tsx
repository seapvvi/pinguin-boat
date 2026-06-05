'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Trophy, RefreshCw, Search } from 'lucide-react';
import { Card, Button, Input, Table, EmptyState, Skeleton } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import type { Column } from '@pinguin/ui';

interface InviteEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string | null;
  totalInvites: number;
  fakeInvites: number;
  leftInvites: number;
  netInvites: number;
}

export default function InvitesPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [leaderboard, setLeaderboard] = useState<InviteEntry[]>([]);
  const [filteredLeaderboard, setFilteredLeaderboard] = useState<InviteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ success: boolean; data: { leaderboard: InviteEntry[] } }>(
        `/api/guilds/${guildId}/invites/leaderboard`
      );
      if (res.success && res.data && Array.isArray(res.data.leaderboard)) {
        setLeaderboard(res.data.leaderboard);
        setFilteredLeaderboard(res.data.leaderboard);
      } else {
        setError('Format de réponse invalide');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useEffect(() => { load(); }, [guildId]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredLeaderboard(leaderboard);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredLeaderboard(
        leaderboard.filter(entry => entry.username.toLowerCase().includes(query))
      );
    }
  }, [searchQuery, leaderboard]);

  const columns: Column<InviteEntry>[] = [
    { key: 'rank', label: '#', render: (e) => <span className="text-xs font-bold text-[var(--text-secondary)]">#{e.rank}</span> },
    { key: 'user', label: 'Utilisateur', render: (e) => (
      <div className="flex items-center gap-2">
        {e.avatar ? (
          <img src={`https://cdn.discordapp.com/avatars/${e.userId}/${e.avatar}.png?size=32`} alt="" className="w-6 h-6 rounded-[0px]" />
        ) : (
          <div className="w-6 h-6 rounded-[0px] bg-[var(--bg-surface-alt)] flex items-center justify-center">
            <span className="text-xs text-[var(--text-secondary)]">{e.username.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <span className="text-sm truncate max-w-[120px]">{e.username}</span>
      </div>
    )},
    { key: 'totalInvites', label: 'Invitations', sortable: true, render: (e) => <span className="text-xs font-mono">{formatNumber(e.totalInvites)}</span> },
    { key: 'fakeInvites', label: 'Faux', sortable: true, render: (e) => <span className="text-xs font-mono text-[var(--error)]">{formatNumber(e.fakeInvites)}</span> },
    { key: 'leftInvites', label: 'Partis', sortable: true, render: (e) => <span className="text-xs font-mono text-[var(--text-secondary)]">{formatNumber(e.leftInvites)}</span> },
    { key: 'netInvites', label: 'Net', sortable: true, render: (e) => <span className="text-xs font-mono font-semibold text-[var(--accent)]">{formatNumber(e.netInvites)}</span> },
  ];

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[var(--radius)]" />
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Invitations</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Classement des invitations du serveur.</p>
        </div>
        <Button variant="secondary" loading={refreshing} onClick={handleRefresh}>
          <RefreshCw size={14} className="mr-2" />
          Actualiser
        </Button>
      </div>

      <Card>
        <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search size={16} className="text-[var(--text-secondary)]" />
            <Input
              placeholder="Rechercher un utilisateur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>
        {filteredLeaderboard.length === 0 ? (
          <EmptyState
            title={searchQuery ? "Aucun résultat" : "Aucune donnée"}
            description={searchQuery ? "Aucun utilisateur ne correspond à votre recherche." : "Le classement des invitations est vide."}
          />
        ) : (
          <Table columns={columns} data={filteredLeaderboard} keyExtractor={(e) => e.userId} />
        )}
      </Card>
    </motion.div>
  );
}
