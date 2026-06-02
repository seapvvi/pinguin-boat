'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Swords, Users, Trophy, TrendingUp, Shield
} from 'lucide-react';
import { Card, Toggle, Input, Button, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, fetchClans } from '@/lib/api';
import type { GuildConfig } from '@pinguin/shared';
import { ModuleToggle } from '@/components/ModuleToggle';
import { useBackgroundRefresh } from '@/lib/hooks';

interface ClanMember {
  id: string;
  userId: string;
  username: string;
  avatar: string | null;
  role: string;
  joinedAt: string;
}

interface Clan {
  id: string;
  name: string;
  ownerId: string;
  description: string | null;
  memberCount: number;
  totalXp: number;
  totalWallet: number;
  members: ClanMember[];
}

export default function ClansPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [clans, setClans] = useState<Clan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [settingsRes, clansRes] = await Promise.all([
        fetchGuildSettings(guildId),
        fetchClans(guildId),
      ]);
      if (settingsRes.success && settingsRes.data) {
        setConfig(settingsRes.data.guild);
      }
      if (clansRes.success && clansRes.data) {
        setClans(clansRes.data.clans ?? []);
      }
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);
  useBackgroundRefresh(load, 15000, [guildId]);

  const sortedByXp = [...clans].sort((a, b) => b.totalXp - a.totalXp);

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
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[var(--radius)]" />
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Clans</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">G&eacute;rez les clans du serveur.</p>
        </div>
      </div>

      <div className="mb-4">
        <ModuleToggle guildId={guildId} moduleKey="clans" label="Clans" description="Activer le syst&egrave;me de clans" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Classement des clans</h2>
          </div>
          {sortedByXp.length === 0 ? (
            <EmptyState title="Aucun clan" description="Aucun clan n'a encore &eacute;t&eacute; cr&eacute;&eacute; sur ce serveur." />
          ) : (
            <div className="space-y-2">
              {sortedByXp.map((clan, index) => (
                <div key={clan.id} className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[var(--text-secondary)] w-5">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </span>
                    <div>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{clan.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[var(--text-secondary)]">
                          <Users size={12} className="inline mr-0.5" />
                          {clan.memberCount}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">
                          <Trophy size={12} className="inline mr-0.5" />
                          {clan.totalXp} XP
                        </span>
                      </div>
                    </div>
                  </div>
                  {clan.description && (
                    <span className="text-xs text-[var(--text-secondary)] truncate max-w-[120px] ml-2">
                      {clan.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Liste des clans</h2>
          </div>
          {clans.length === 0 ? (
            <EmptyState title="Aucun clan" description="Cr&eacute;ez un clan avec la commande /clan create dans Discord." />
          ) : (
            <div className="space-y-4">
              {clans.map((clan) => (
                <div key={clan.id} className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{clan.name}</span>
                      {clan.description && (
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{clan.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-secondary)]">
                      <Users size={12} className="inline mr-0.5" />
                      {clan.memberCount} membre{clan.memberCount > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {clan.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between py-1 px-2 rounded bg-[var(--bg-surface)]">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--text-secondary)]">{member.username}</span>
                          {member.role === 'OWNER' && <Shield size={12} className="text-[var(--accent)]" />}
                          {member.role === 'OFFICER' && <Shield size={12} className="text-[var(--text-secondary)]" />}
                        </div>
                        <span className="text-xs text-[var(--text-secondary)]">
                          {member.role === 'OWNER' ? 'Propri&eacute;taire' : member.role === 'OFFICER' ? 'Officier' : 'Membre'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Param&egrave;tres</h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Les clans sont g&eacute;r&eacute;s via les commandes Discord. Utilisez <code className="text-[var(--accent)]">/clan</code> pour cr&eacute;er, g&eacute;rer et d&eacute;fier d&rsquo;autres clans.
          </p>
          <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
            <div>
              <span className="text-sm text-[var(--text-primary)]">Guerres de clans</span>
              <p className="text-xs text-[var(--text-secondary)]">Les clans peuvent s&rsquo;affronter via des guerres</p>
            </div>
            <span className="text-xs font-medium text-[var(--accent)]">Actif</span>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}