'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Wallet, TrendingUp, Banknote, ShoppingCart,
  Plus, Coins
} from 'lucide-react';
import { Card, Toggle, Input, Button, Badge, Table, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, fetchEconomyLeaderboard, updateGuildSettings } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import type { GuildConfig, EconomySettings } from '@pinguin/shared';
import type { Column } from '@pinguin/ui';
import { ModuleToggle } from '@/components/ModuleToggle';

interface EconomyEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  wallet: number;
  bank: number;
}

export default function EconomyPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [leaderboard, setLeaderboard] = useState<EconomyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState<EconomySettings | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, lbRes] = await Promise.all([
        fetchGuildSettings(guildId),
        fetchEconomyLeaderboard(guildId, { page: '1', limit: '20' }),
      ]);
      if (settingsRes.success && settingsRes.data) {
        setConfig(settingsRes.data.guild);
        setLocal({ ...settingsRes.data.guild.economy });
      }
      if (lbRes.success && lbRes.data) setLeaderboard(lbRes.data.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const handleSave = async () => {
    if (!local) return;
    setSaving(true);
    try {
      const res = await updateGuildSettings(guildId, { economy: local });
      if (res.success && res.data) setConfig(res.data.guild);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const lbColumns: Column<EconomyEntry>[] = [
    { key: 'rank', label: '#', render: (e) => <span className="text-xs font-bold text-[var(--text-secondary)]">#{e.rank}</span> },
    { key: 'user', label: 'Utilisateur', render: (e) => (
      <div className="flex items-center gap-2">
        <img src={`https://cdn.discordapp.com/avatars/${e.userId}/${e.avatar}.png?size=32`} alt="" className="w-6 h-6 rounded-full" />
        <span className="text-sm truncate max-w-[120px]">{e.username}</span>
      </div>
    )},
    { key: 'wallet', label: 'Portefeuille', sortable: true, render: (e) => <span className="text-xs font-mono">{formatNumber(e.wallet)}</span> },
    { key: 'bank', label: 'Banque', sortable: true, render: (e) => <span className="text-xs font-mono">{formatNumber(e.bank)}</span> },
    { key: 'total', label: 'Total', render: (e) => <span className="text-xs font-mono text-[var(--accent)]">{formatNumber(e.wallet + e.bank)}</span> },
  ];

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  if (loading || !local) {
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
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Économie</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Gérez l&apos;économie de votre serveur.</p>
        </div>
        <Button loading={saving} onClick={handleSave}>Enregistrer</Button>
      </div>

      <div className="mb-4"><ModuleToggle guildId={guildId} moduleKey="economy" label="Économie" /></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Coins size={18} className="text-[var(--accent)]" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Module économie</h2>
              </div>
              <Toggle checked={local.enabled} onChange={(v) => setLocal({ ...local, enabled: v })} />
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Paramètres</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Nom de la monnaie" value={local.currencyName} onChange={(e) => setLocal({ ...local, currencyName: e.target.value })} />
              <Input label="Symbole" value={local.currencySymbol} onChange={(e) => setLocal({ ...local, currencySymbol: e.target.value })} />
              <Input label="Montant quotidien" type="number" value={String(local.dailyAmount)} onChange={(e) => setLocal({ ...local, dailyAmount: Number(e.target.value) })} />
              <Input label="Montant hebdomadaire" type="number" value={String(local.weeklyAmount)} onChange={(e) => setLocal({ ...local, weeklyAmount: Number(e.target.value) })} />
              <Input label="Solde de départ" type="number" value={String(local.startupBalance)} onChange={(e) => setLocal({ ...local, startupBalance: Number(e.target.value) })} />
              <Input label="Taux d&apos;intérêt (%)" type="number" value={String(local.interestRate)} onChange={(e) => setLocal({ ...local, interestRate: Number(e.target.value) })} />
              <Input label="Capacité banque" type="number" value={String(local.bankCapacity)} onChange={(e) => setLocal({ ...local, bankCapacity: Number(e.target.value) })} />
              <Input label="Travail min" type="number" value={String(local.workMin)} onChange={(e) => setLocal({ ...local, workMin: Number(e.target.value) })} />
              <Input label="Travail max" type="number" value={String(local.workMax)} onChange={(e) => setLocal({ ...local, workMax: Number(e.target.value) })} />
              <Input label="Cooldown travail (s)" type="number" value={String(local.workCooldown)} onChange={(e) => setLocal({ ...local, workCooldown: Number(e.target.value) })} />
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Banknote size={18} className="text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Vol</h2>
            </div>
            <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] mb-3">
              <div>
                <span className="text-sm text-[var(--text-primary)]">Vol autorisé</span>
                <p className="text-xs text-[var(--text-secondary)]">Permet aux membres de se voler</p>
              </div>
              <Toggle checked={local.robberyEnabled} onChange={(v) => setLocal({ ...local, robberyEnabled: v })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Montant max de vol" type="number" value={String(local.robberyMaxAmount)} onChange={(e) => setLocal({ ...local, robberyMaxAmount: Number(e.target.value) })} />
              <Input label="Cooldown vol (s)" type="number" value={String(local.robberyCooldown)} onChange={(e) => setLocal({ ...local, robberyCooldown: Number(e.target.value) })} />
            </div>
          </Card>
        </div>

        <Card padding={false}>
          <div className="p-5 border-b border-[var(--border-color)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Classement économique</h2>
          </div>
          {leaderboard.length === 0 ? (
            <EmptyState title="Aucune donnée" description="Le classement est vide." />
          ) : (
            <Table columns={lbColumns} data={leaderboard} keyExtractor={(e) => e.userId} />
          )}
        </Card>
      </div>
    </motion.div>
  );
}
