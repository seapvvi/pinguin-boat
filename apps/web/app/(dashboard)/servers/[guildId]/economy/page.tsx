'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Banknote, ShoppingCart, Plus, X, Coins, Trophy, Landmark
} from 'lucide-react';
import { Toggle, Input, Button, Table, EmptyState, Badge } from '@pinguin/ui';
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
import { useAutoSave } from '@/lib/hooks';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';
import { ModuleGrid } from '@/components/layout/ModuleGrid';

const SLIDER_CLASS = 'eco-slider';

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
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!isNaN(v) && v >= min && v <= max) onChange(v);
            }}
            className="w-20 px-2 py-0.5 text-xs font-mono text-right bg-transparent border border-[var(--border-color)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          <span className="text-xs font-mono text-[var(--accent)]">
            {formatValue ? formatValue(value) : value.toLocaleString('fr-FR')}{suffix ?? ''}
          </span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${SLIDER_CLASS} w-full h-1.5 appearance-none cursor-pointer`}
        style={{
          borderRadius: 0,
          background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--bg-surface-alt) ${pct}%, var(--bg-surface-alt) 100%)`,
        }}
      />
    </div>
  );
}

export default function EconomyPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [leaderboard, setLeaderboard] = useState<EconomyEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [local, setLocal] = useState<LocalSettings | null>(null);
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
  // Pas de background refresh — l'auto-save gère la persistance, le refresh écraserait les edits locaux

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

  const totalCirculation = leaderboard.reduce((sum, e) => sum + e.wallet + e.bank, 0);
  const topWallet = leaderboard[0];

  const lbColumns: Column<EconomyEntry>[] = [
    { key: 'rank', label: '#', render: (e) => <span className="text-xs font-bold text-[var(--text-secondary)]">#{e.rank}</span> },
    { key: 'user', label: 'Utilisateur', render: (e) => (
      <div className="flex items-center gap-2">
        <img src={`https://cdn.discordapp.com/avatars/${e.userId}/${e.avatar}.png?size=32`} alt="" className="w-6 h-6" />
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

  if (!local) return null;

  const isReadOnly = !local.enabled;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <PageLayout
        title="Économie"
        description="Gérez l'économie de votre serveur."
        actions={<Button loading={saving} onClick={handleSave}>Enregistrer</Button>}
      >
        <style>{`
          .${SLIDER_CLASS}::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 14px;
            height: 14px;
            background: var(--accent);
            border-radius: 0;
            cursor: pointer;
          }
          .${SLIDER_CLASS}::-moz-range-thumb {
            width: 14px;
            height: 14px;
            background: var(--accent);
            border-radius: 0;
            cursor: pointer;
            border: none;
          }
        `}</style>

        {saveError && (
          <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 px-3 py-2 mb-4">{saveError}</div>
        )}
        {validationErrors.workMax && (
          <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 px-3 py-2 mb-4">{validationErrors.workMax}</div>
        )}

        <PermissionGate permission="manageGuild">
          <div className="mb-4">
            <ModuleToggle guildId={guildId} moduleKey="economy" label="Économie" description="Active ou désactive le module économique sur le serveur" />
          </div>

          {isReadOnly && (
            <div className="mb-4 p-3 bg-[var(--warning-bg)] border border-[var(--warning-border)] text-sm text-[var(--warning-text)]">
              Activez l'économie pour modifier ces paramètres.
            </div>
          )}

          <div className="space-y-6">
            <ModuleGrid>
              <SectionCard title="Gains quotidiens" icon={<Banknote size={16} />}>
                <div className="space-y-4">
                  <SliderField
                    label="/daily — montant"
                    value={local.dailyAmount ?? 100}
                    onChange={(v) => updateField('dailyAmount', v)}
                    min={ECONOMY_LIMITS.dailyAmount.min}
                    max={ECONOMY_LIMITS.dailyAmount.max}
                    suffix=" pièces"
                  />
                  <SliderField
                    label="/work — gain minimum"
                    value={local.workMin}
                    onChange={(v) => updateField('workMin', v)}
                    min={ECONOMY_LIMITS.workMin.min}
                    max={local.workMax}
                    suffix=" pièces"
                  />
                  <SliderField
                    label="/work — gain maximum"
                    value={local.workMax}
                    onChange={(v) => updateField('workMax', v)}
                    min={local.workMin}
                    max={ECONOMY_LIMITS.workMax.max}
                    suffix=" pièces"
                  />
                  {local.workMax < local.workMin && (
                    <p className="text-xs text-[var(--error)]">Le maximum doit être ≥ au minimum</p>
                  )}
                  <SliderField
                    label="/work — cooldown"
                    value={local.workCooldown}
                    onChange={(v) => updateField('workCooldown', v)}
                    min={ECONOMY_LIMITS.workCooldown.min}
                    max={ECONOMY_LIMITS.workCooldown.max}
                    formatValue={formatCooldownLabel}
                  />
                  <SliderField
                    label="/daily — cooldown"
                    value={local.robberyCooldown}
                    onChange={(v) => updateField('robberyCooldown', v)}
                    min={ECONOMY_LIMITS.robberyCooldown.min}
                    max={ECONOMY_LIMITS.robberyCooldown.max}
                    formatValue={formatCooldownLabel}
                  />
                </div>
              </SectionCard>

              <SectionCard title="Banque" icon={<Landmark size={16} />}>
                <div className="space-y-4">
                  <SliderField
                    label="Plafond"
                    value={local.bankCapacity}
                    onChange={(v) => updateField('bankCapacity', v)}
                    min={ECONOMY_LIMITS.bankCapacity.min}
                    max={ECONOMY_LIMITS.bankCapacity.max}
                    formatValue={(v) => formatNumber(v)}
                    suffix=" pièces"
                  />
                  <SliderField
                    label="Taux d'intérêt"
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
              </SectionCard>
            </ModuleGrid>

            <SectionCard
              title="Boutique de rôles"
              icon={<ShoppingCart size={16} />}
              headerAction={
                <Button variant="secondary" size="sm" onClick={() => { setEditingItem(null); setShopFormOpen(true); }} disabled={isReadOnly}>
                  <Plus size={14} className="mr-1" /> Ajouter un item
                </Button>
              }
            >
              {local.shopItems.length === 0 ? (
                <EmptyState title="Boutique vide" description="Ajoutez des articles via le bouton ci-dessus." />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {local.shopItems.map((item, i) => (
                    <div
                      key={item.id || i}
                      className="p-4 border border-[var(--border-color)] bg-[var(--bg-surface)]"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-sm font-semibold text-[var(--text-primary)] truncate ${!item.isActive && item.isActive !== undefined ? 'line-through opacity-50' : ''}`}>
                            {item.name}
                          </span>
                          <Badge variant="info">{ITEM_TYPE_LABELS[item.type] || item.type}</Badge>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            type="button"
                            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] transition-colors"
                            onClick={() => {
                              setEditingItem({ ...item });
                              setShopFormOpen(true);
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                          </button>
                          {deleteConfirm === item.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="p-1 text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors text-xs font-medium"
                                onClick={() => removeShopItem(i)}
                              >
                                Confirmer
                              </button>
                              <button
                                type="button"
                                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                onClick={() => setDeleteConfirm(null)}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="p-1 text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                              onClick={() => setDeleteConfirm(item.id)}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <span className="font-mono text-[var(--accent)]">{item.price.toLocaleString('fr-FR')} {local.currencySymbol}</span>
                        {item.type === 'ROLE' && item.roleId && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[100px]">Rôle: <code className="text-[var(--accent)]">{item.roleId.slice(0, 8)}…</code></span>
                          </>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-[var(--text-secondary)] mt-1 truncate">{item.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <ModuleGrid>
              <SectionCard title="Monnaie" icon={<Coins size={16} />}>
                <div className="space-y-4">
                  <Input label="Nom" value={local.currencyName} onChange={(e) => updateField('currencyName', e.target.value)} disabled={isReadOnly} />
                  <Input label="Symbole" value={local.currencySymbol} onChange={(e) => updateField('currencySymbol', e.target.value)} disabled={isReadOnly} />
                  <div className="border-t border-[var(--border-color)] pt-4">
                    <div className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]">
                      <div>
                        <span className="text-sm text-[var(--text-primary)]">Vol autorisé</span>
                        <p className="text-xs text-[var(--text-secondary)]">Permet aux membres de se voler</p>
                      </div>
                      <Toggle checked={local.robberyEnabled} onChange={(v) => updateField('robberyEnabled', v)} disabled={isReadOnly} />
                    </div>
                    {local.robberyEnabled && (
                      <div className="mt-3 space-y-3">
                        <SliderField
                          label="Montant max de vol"
                          value={local.robberyMaxAmount}
                          onChange={(v) => updateField('robberyMaxAmount', v)}
                          min={ECONOMY_LIMITS.robberyMaxAmount.min}
                          max={ECONOMY_LIMITS.robberyMaxAmount.max}
                          suffix=" pièces"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Classement" icon={<Trophy size={16} />}>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-[var(--bg-surface-alt)]">
                      <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">En circulation</p>
                      <p className="text-lg font-bold text-[var(--accent)] mt-1">{formatNumber(totalCirculation)}</p>
                    </div>
                    <div className="text-center p-3 bg-[var(--bg-surface-alt)]">
                      <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Classés</p>
                      <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{leaderboard.length}</p>
                    </div>
                    <div className="text-center p-3 bg-[var(--bg-surface-alt)]">
                      <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Plus riche</p>
                      {topWallet ? (
                        <>
                          <p className="text-sm font-medium text-[var(--text-primary)] mt-1 truncate">{topWallet.username}</p>
                          <p className="text-sm font-bold text-[var(--accent)]">{formatNumber(topWallet.wallet + topWallet.bank)}</p>
                        </>
                      ) : (
                        <p className="text-sm text-[var(--text-secondary)] mt-1">—</p>
                      )}
                    </div>
                  </div>
                  {leaderboard.length === 0 ? (
                    <EmptyState title="Aucune donnée" description="Le classement est vide." />
                  ) : (
                    <Table columns={lbColumns} data={leaderboard} keyExtractor={(e) => e.userId} />
                  )}
                </div>
              </SectionCard>
            </ModuleGrid>
          </div>

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
      </PageLayout>
    </motion.div>
  );
}
