'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Banknote, ShoppingCart, Plus
} from 'lucide-react';
import { Card, Toggle, Input, Button, Table, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, fetchEconomyLeaderboard, updateGuildSettings } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import type { GuildConfig, EconomySettings } from '@pinguin/shared';
import type { Column } from '@pinguin/ui';
import { ModuleToggle } from '@/components/ModuleToggle';
import { PermissionGate } from '@/components/PermissionGate';
import { DiscordSelect } from '@/components/DiscordSelect';
import { useBackgroundRefresh, useAutoSave } from '@/lib/hooks';

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
  const [leaderboard, setLeaderboard] = useState<EconomyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [local, setLocal] = useState<EconomySettings | null>(null);
  const [shopItems, setShopItems] = useState<Array<{ id?: string; name: string; description?: string; price: number; roleId?: string }>>([]);
  const [newItem, setNewItem] = useState({ name: '', description: '', price: 100, roleId: '' });

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [settingsRes, lbRes] = await Promise.all([
        fetchGuildSettings(guildId),
        fetchEconomyLeaderboard(guildId, { page: '1', limit: '20' }),
      ]);
      if (settingsRes.success && settingsRes.data) {
        const ec = settingsRes.data.guild.economy as EconomySettings & { shopItems?: typeof shopItems };
        setLocal({ ...ec });
        setShopItems(ec.shopItems ?? []);
      }
      if (lbRes.success && lbRes.data) setLeaderboard(lbRes.data.entries ?? []);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);
  useBackgroundRefresh(load, 10000, [guildId]);

  const saveEconomy = async (data: EconomySettings) => {
    const res = await updateGuildSettings(guildId, { economy: { ...data, shopItems } });
  };

  useAutoSave(local, saveEconomy, { enabled: !!local });

  const handleSave = async () => {
    if (!local) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveEconomy(local);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const lbColumns: Column<EconomyEntry>[] = [
    { key: 'rank', label: '#', render: (e) => <span className="text-xs font-bold text-[var(--text-secondary)]">#{e.rank}</span> },
    { key: 'user', label: 'Utilisateur', render: (e) => (
      <div className="flex items-center gap-2">
        <img src={`https://cdn.discordapp.com/avatars/${e.userId}/${e.avatar}.png?size=32`} alt="" className="w-6 h-6 rounded-[0px]" />
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
      {saveError && <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] p-2 rounded mb-4">{saveError}</div>}

      <PermissionGate permission="manageGuild">
      <div className="mb-4"><ModuleToggle guildId={guildId} moduleKey="economy" label="Économie" /></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="space-y-6">
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

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart size={18} className="text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Articles boutique</h2>
            </div>
            {shopItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-2 mb-2 rounded bg-[var(--bg-surface-alt)]">
                <span className="text-sm">{item.name} — {item.price} {local.currencySymbol}</span>
                <Button variant="secondary" size="sm" onClick={() => setShopItems(shopItems.filter((_, j) => j !== i))}>Supprimer</Button>
              </div>
            ))}
            <div className="grid grid-cols-1 gap-3 mt-3">
              <Input label="Nom" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
              <Input label="Prix" type="number" value={String(newItem.price)} onChange={(e) => setNewItem({ ...newItem, price: Number(e.target.value) })} />
              <Input label="Description" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
              <DiscordSelect type="role" guildId={guildId} label="Rôle à attribuer (optionnel)" value={newItem.roleId} onChange={(id) => setNewItem({ ...newItem, roleId: id })} />
              <Button variant="secondary" onClick={() => {
                if (!newItem.name.trim()) return;
                setShopItems([...shopItems, { ...newItem, roleId: newItem.roleId || undefined }]);
                setNewItem({ name: '', description: '', price: 100, roleId: '' });
              }}>
                <Plus size={14} className="mr-1" /> Ajouter l&apos;article
              </Button>
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
      </PermissionGate>
    </motion.div>
  );
}
