'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Banknote, ShoppingCart, BarChart3, Settings, Plus, X, GripVertical
} from 'lucide-react';
import { Card, Toggle, Input, Button, Table, Skeleton, EmptyState, Badge } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, fetchEconomyLeaderboard, updateGuildSettings } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { ECONOMY_LIMITS, validateEconomySettings } from '@/lib/economy-validation';
import { formatCooldownLabel } from '@/lib/format-duration';
import type { EconomySettings, ShopItem } from '@pinguin/shared';
import type { Column } from '@pinguin/ui';
import { ModuleToggle } from '@/components/ModuleToggle';
import { PermissionGate } from '@/components/PermissionGate';
import { ShopItemForm } from '@/components/economy/ShopItemForm';
import { useBackgroundRefresh, useAutoSave } from '@/lib/hooks';

type Tab = 'config' | 'shop' | 'stats';

interface EconomyEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  wallet: number;
  bank: number;
}

interface LocalSettings extends EconomySettings {
  shopItems: ShopItem[];
}

const TABS: { key: Tab; label: string; icon: typeof Settings }[] = [
  { key: 'config', label: 'Configuration', icon: Settings },
  { key: 'shop', label: 'Boutique', icon: ShoppingCart },
  { key: 'stats', label: 'Statistiques', icon: BarChart3 },
];

const ITEM_TYPE_LABELS: Record<string, string> = {
  ROLE: 'Rôle',
  XP_BOOST: 'Boost XP',
  ANTI_THEFT: 'Anti-vol',
  LOTTO_TICKET: 'Ticket loto',
};

function SliderField({
  label, value, onChange, min, max, step = 1, formatValue, suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  formatValue?: (v: number) => string;
  suffix?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase">{label}</label>
        <span className="text-xs font-mono text-[var(--accent)]">
          {formatValue ? formatValue(value) : value.toLocaleString('fr-FR')}{suffix ?? ''}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[var(--bg-surface-alt)] accent-[var(--accent)]"
          style={{
            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--bg-surface-alt) ${pct}%, var(--bg-surface-alt) 100%)`,
          }}
        />
      </div>
    </div>
  );
}

export default function EconomyPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [leaderboard, setLeaderboard] = useState<EconomyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [local, setLocal] = useState<LocalSettings | null>(null);
  const [tab, setTab] = useState<Tab>('config');
  const [shopFormOpen, setShopFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [settingsRes, lbRes] = await Promise.all([
        fetchGuildSettings(guildId),
        fetchEconomyLeaderboard(guildId, { page: '1', limit: '20' }),
      ]);
      if (settingsRes.success && settingsRes.data) {
        const ec = settingsRes.data.guild.economy as LocalSettings;
        setLocal({
          ...ec,
          dailyAmount: ec.dailyAmount ?? 100,
          shopItems: ec.shopItems ?? [],
        });
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

  const saveEconomy = async (data: LocalSettings) => {
    const { shopItems, ...settings } = data;
    const errors = validateEconomySettings(settings as unknown as Record<string, number>);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      throw new Error(Object.values(errors)[0]);
    }
    setValidationErrors({});
    await updateGuildSettings(guildId, { economy: { ...settings, shopItems } });
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

  const updateField = <K extends keyof EconomySettings>(key: K, value: EconomySettings[K]) => {
    if (!local) return;
    setLocal({ ...local, [key]: value });
  };

  const addShopItem = (item: Omit<ShopItem, 'id' | 'economySettingsId'>) => {
    if (!local) return;
    const newItem: ShopItem = {
      ...item,
      id: crypto.randomUUID?.() ?? `${Date.now()}`,
    };
    setLocal({ ...local, shopItems: [...local.shopItems, newItem] });
  };

  const updateShopItem = (index: number, patch: Partial<ShopItem>) => {
    if (!local) return;
    const items = [...local.shopItems];
    items[index] = { ...items[index], ...patch };
    setLocal({ ...local, shopItems: items });
  };

  const removeShopItem = (index: number) => {
    if (!local) return;
    setLocal({ ...local, shopItems: local.shopItems.filter((_, i) => i !== index) });
    setDeleteConfirm(null);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    if (!local) return;
    const items = [...local.shopItems];
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    setLocal({ ...local, shopItems: items });
  };

  const totalCirculation = leaderboard.reduce((sum, e) => sum + e.wallet + e.bank, 0);
  const topWallet = leaderboard[0];

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

  const isReadOnly = !local.enabled;

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
      {validationErrors.workMax && <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] p-2 rounded mb-4">{validationErrors.workMax}</div>}

      <PermissionGate permission="manageGuild">
      <div className="mb-4">
        <ModuleToggle guildId={guildId} moduleKey="economy" label="Économie" description="Active ou désactive le module économique sur le serveur" />
      </div>

      {isReadOnly && (
        <div className="mb-4 p-3 rounded-[var(--radius-sm)] bg-[var(--warning-bg)] border border-[var(--warning-border)] text-sm text-[var(--warning-text)]">
          Activez l&apos;économie pour modifier ces paramètres.
        </div>
      )}

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 mb-6 p-1 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-[var(--radius-sm)] transition-colors ${
                tab === t.key
                  ? 'bg-[var(--accent)] text-[var(--bg-primary)] font-medium'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ─── Onglet Configuration ─── */}
      {tab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="space-y-6">
            <Card>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Paramètres généraux</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Nom de la monnaie" value={local.currencyName} onChange={(e) => updateField('currencyName', e.target.value)} disabled={isReadOnly} />
                <Input label="Symbole" value={local.currencySymbol} onChange={(e) => updateField('currencySymbol', e.target.value)} disabled={isReadOnly} />
              </div>
            </Card>

            <Card>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Gains</h2>
              <div className="space-y-4">
                <SliderField
                  label="Montant quotidien"
                  value={local.dailyAmount ?? 100}
                  onChange={(v) => updateField('dailyAmount', v)}
                  min={ECONOMY_LIMITS.dailyAmount.min}
                  max={ECONOMY_LIMITS.dailyAmount.max}
                  suffix=" pièces"
                />
                <SliderField
                  label="Montant hebdomadaire"
                  value={local.weeklyAmount}
                  onChange={(v) => updateField('weeklyAmount', v)}
                  min={ECONOMY_LIMITS.weeklyAmount.min}
                  max={ECONOMY_LIMITS.weeklyAmount.max}
                  suffix=" pièces"
                />
                <SliderField
                  label="Solde de départ"
                  value={local.startupBalance}
                  onChange={(v) => updateField('startupBalance', v)}
                  min={ECONOMY_LIMITS.startupBalance.min}
                  max={ECONOMY_LIMITS.startupBalance.max}
                  suffix=" pièces"
                />
                <div className="border-t border-[var(--border-color)] my-2" />
                <SliderField
                  label="Travail — gain minimum"
                  value={local.workMin}
                  onChange={(v) => updateField('workMin', v)}
                  min={ECONOMY_LIMITS.workMin.min}
                  max={local.workMax}
                  suffix=" pièces"
                />
                <SliderField
                  label="Travail — gain maximum"
                  value={local.workMax}
                  onChange={(v) => updateField('workMax', v)}
                  min={local.workMin}
                  max={ECONOMY_LIMITS.workMax.max}
                  suffix=" pièces"
                />
                {local.workMax < local.workMin && (
                  <p className="text-xs text-[var(--error)]">Le maximum doit être ≥ au minimum</p>
                )}
              </div>
            </Card>

            <Card>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Cooldowns</h2>
              <div className="space-y-4">
                <SliderField
                  label="Travail — cooldown"
                  value={local.workCooldown}
                  onChange={(v) => updateField('workCooldown', v)}
                  min={ECONOMY_LIMITS.workCooldown.min}
                  max={ECONOMY_LIMITS.workCooldown.max}
                  formatValue={formatCooldownLabel}
                />
                <SliderField
                  label="Vol — cooldown"
                  value={local.robberyCooldown}
                  onChange={(v) => updateField('robberyCooldown', v)}
                  min={ECONOMY_LIMITS.robberyCooldown.min}
                  max={ECONOMY_LIMITS.robberyCooldown.max}
                  formatValue={formatCooldownLabel}
                />
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Banque & Intérêts</h2>
              <div className="space-y-4">
                <SliderField
                  label="Capacité banque"
                  value={local.bankCapacity}
                  onChange={(v) => updateField('bankCapacity', v)}
                  min={ECONOMY_LIMITS.bankCapacity.min}
                  max={ECONOMY_LIMITS.bankCapacity.max}
                  formatValue={(v) => formatNumber(v)}
                  suffix=" pièces"
                />
                <SliderField
                  label="Taux d&apos;intérêt (%)"
                  value={local.interestRate}
                  onChange={(v) => updateField('interestRate', v)}
                  min={ECONOMY_LIMITS.interestRate.min}
                  max={ECONOMY_LIMITS.interestRate.max}
                  suffix="%"
                />
                <SliderField
                  label="Intervalle des intérêts"
                  value={local.interestInterval}
                  onChange={(v) => updateField('interestInterval', v)}
                  min={ECONOMY_LIMITS.interestInterval.min}
                  max={ECONOMY_LIMITS.interestInterval.max}
                  formatValue={formatCooldownLabel}
                />
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
                <Toggle checked={local.robberyEnabled} onChange={(v) => updateField('robberyEnabled', v)} disabled={isReadOnly} />
              </div>
              <div className="space-y-4">
                <SliderField
                  label="Montant max de vol"
                  value={local.robberyMaxAmount}
                  onChange={(v) => updateField('robberyMaxAmount', v)}
                  min={ECONOMY_LIMITS.robberyMaxAmount.min}
                  max={ECONOMY_LIMITS.robberyMaxAmount.max}
                  suffix=" pièces"
                />
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ─── Onglet Boutique ─── */}
      {tab === 'shop' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Articles de la boutique</h2>
            <Button variant="secondary" size="sm" onClick={() => { setEditingItem(null); setShopFormOpen(true); }} disabled={isReadOnly}>
              <Plus size={14} className="mr-1" /> Ajouter
            </Button>
          </div>

          {local.shopItems.length === 0 ? (
            <EmptyState title="Boutique vide" description="Ajoutez des articles via le bouton ci-dessus." />
          ) : (
            <div className="space-y-2">
              {local.shopItems.map((item, i) => (
                <div
                  key={item.id || i}
                  className="flex items-center gap-3 p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] group"
                >
                  <button
                    type="button"
                    className="cursor-grab text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => {
                      const btn = e.currentTarget;
                      const handleMove = (ev: MouseEvent) => {
                        const rect = btn.getBoundingClientRect();
                        const dy = ev.clientY - rect.top;
                        if (Math.abs(dy) > 20) {
                          moveItem(i, dy < 0 ? -1 : 1);
                          document.removeEventListener('mousemove', handleMove);
                        }
                      };
                      const handleUp = () => document.removeEventListener('mousemove', handleMove);
                      document.addEventListener('mousemove', handleMove);
                      document.addEventListener('mouseup', handleUp, { once: true });
                    }}
                  >
                    <GripVertical size={14} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium text-[var(--text-primary)] ${!item.isActive && item.isActive !== undefined ? 'line-through opacity-50' : ''}`}>
                        {item.name}
                      </span>
                      <Badge variant="info">{ITEM_TYPE_LABELS[item.type] || item.type}</Badge>
                      {item.type === 'ROLE' && item.roleId && (
                        <span className="text-xs text-[var(--text-secondary)] truncate max-w-[100px]">
                          → <code className="text-[var(--accent)]">{item.roleId.slice(0, 8)}…</code>
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{item.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-[var(--accent)]">{item.price.toLocaleString('fr-FR')} {local.currencySymbol}</span>
                      {item.duration && (
                        <span className="text-xs text-[var(--text-secondary)]">· {formatCooldownLabel(item.duration)}</span>
                      )}
                      {item.effectValue && item.type === 'XP_BOOST' && (
                        <span className="text-xs text-[var(--text-secondary)]">· ×{item.effectValue}</span>
                      )}
                      {item.effectValue && item.type === 'LOTTO_TICKET' && (
                        <span className="text-xs text-[var(--text-secondary)]">· {item.effectValue} tickets</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                      onClick={() => {
                        setEditingItem({ ...item });
                        setShopFormOpen(true);
                      }}
                    >
                      <Settings size={14} />
                    </button>
                    {deleteConfirm === item.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors text-xs font-medium"
                          onClick={() => removeShopItem(i)}
                        >
                          Confirmer
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                          onClick={() => setDeleteConfirm(null)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors"
                        onClick={() => setDeleteConfirm(item.id)}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ─── Onglet Statistiques ─── */}
      {tab === 'stats' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="text-center">
              <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Monnaie en circulation</p>
              <p className="text-2xl font-bold text-[var(--accent)] mt-1">{formatNumber(totalCirculation)}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{local.currencySymbol} {local.currencyName}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Membres classés</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{leaderboard.length}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Plus riche</p>
              {topWallet ? (
                <>
                  <p className="text-sm font-medium text-[var(--text-primary)] mt-1 truncate">{topWallet.username}</p>
                  <p className="text-lg font-bold text-[var(--accent)]">{formatNumber(topWallet.wallet + topWallet.bank)}</p>
                </>
              ) : (
                <p className="text-sm text-[var(--text-secondary)] mt-1">—</p>
              )}
            </div>
          </Card>

          <div className="lg:col-span-3">
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
        </div>
      )}

      <ShopItemForm
        open={shopFormOpen}
        onClose={() => { setShopFormOpen(false); setEditingItem(null); }}
        onSave={(itemData) => {
          if (editingItem) {
            const idx = local.shopItems.findIndex((s) => s.id === editingItem.id);
            if (idx !== -1) updateShopItem(idx, itemData);
          } else {
            addShopItem(itemData);
          }
        }}
        guildId={guildId}
        initial={editingItem}
      />
      </PermissionGate>
    </motion.div>
  );
}
