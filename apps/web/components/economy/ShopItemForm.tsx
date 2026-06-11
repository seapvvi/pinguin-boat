'use client';
import { useState } from 'react';
import { Input, Button, Select, Modal, Toggle } from '@pinguin/ui';
import { DiscordSelect } from '@/components/DiscordSelect';
import type { ShopItem, ItemType } from '@pinguin/shared';

interface ShopItemFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: Omit<ShopItem, 'id' | 'economySettingsId'>) => void;
  guildId: string;
  initial?: ShopItem | null;
}

const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: 'ROLE', label: 'Rôle' },
  { value: 'XP_BOOST', label: 'Boost XP' },
  { value: 'ANTI_THEFT', label: 'Anti-vol' },
  { value: 'LOTTO_TICKET', label: 'Ticket loto' },
];

export function ShopItemForm({ open, onClose, onSave, guildId, initial }: ShopItemFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(String(initial?.price ?? 100));
  const [type, setType] = useState<ItemType>(initial?.type ?? 'ROLE');
  const [roleId, setRoleId] = useState(initial?.roleId ?? '');
  const [unlimitedDuration, setUnlimitedDuration] = useState(initial?.duration === null || initial === null);
  const [duration, setDuration] = useState(String(initial?.duration ? Math.floor(initial.duration / 3600) : 24));
  const [effectValue, setEffectValue] = useState(String(initial?.effectValue ?? ''));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Le nom est requis';
    const p = parseInt(price, 10);
    if (isNaN(p) || p < 1) e.price = 'Le prix doit être ≥ 1';
    if (type === 'ROLE' && !roleId) e.roleId = 'Un rôle est requis pour ce type';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSave({
      name: name.trim(),
      description: description.trim() || null,
      price: parseInt(price, 10),
      type,
      roleId: type === 'ROLE' ? roleId : null,
      duration: unlimitedDuration ? null : parseInt(duration, 10) * 3600,
      effectValue: effectValue ? parseInt(effectValue, 10) : null,
    });
    setName('');
    setDescription('');
    setPrice('100');
    setType('ROLE');
    setRoleId('');
    setUnlimitedDuration(true);
    setDuration('24');
    setEffectValue('');
    setErrors({});
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Modifier l\'article' : 'Nouvel article'}>
      <div className="space-y-4">
        <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="Prix" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} error={errors.price} />

        <Select label="Type" options={ITEM_TYPES} value={type} onChange={(e) => setType(e.target.value as ItemType)} />

        {type === 'ROLE' && (
          <DiscordSelect
            type="role"
            guildId={guildId}
            label="Rôle à attribuer"
            value={roleId}
            onChange={(id) => setRoleId(id)}
          />
        )}

        {type === 'XP_BOOST' && (
          <div className="space-y-3">
            <Input
              label="Multiplicateur (×)"
              type="number"
              min={1}
              max={10}
              value={effectValue || '2'}
              onChange={(e) => setEffectValue(e.target.value)}
            />
            <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
              <div>
                <span className="text-sm text-[var(--text-primary)]">Durée illimitée</span>
                <p className="text-xs text-[var(--text-secondary)]">Laisse vide la durée</p>
              </div>
              <Toggle checked={unlimitedDuration} onChange={setUnlimitedDuration} />
            </div>
            {!unlimitedDuration && (
              <Input
                label="Durée (heures)"
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            )}
          </div>
        )}

        {type === 'ANTI_THEFT' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
              <div>
                <span className="text-sm text-[var(--text-primary)]">Durée illimitée</span>
                <p className="text-xs text-[var(--text-secondary)]">Protection permanente</p>
              </div>
              <Toggle checked={unlimitedDuration} onChange={setUnlimitedDuration} />
            </div>
            {!unlimitedDuration && (
              <Input
                label="Durée (heures)"
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            )}
          </div>
        )}

        {type === 'LOTTO_TICKET' && (
          <Input
            label="Quantité de tickets"
            type="number"
            min={1}
            value={effectValue || '1'}
            onChange={(e) => setEffectValue(e.target.value)}
          />
        )}

        {errors.roleId && <p className="text-xs text-[var(--error)]">{errors.roleId}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit}>{initial ? 'Enregistrer' : 'Ajouter'}</Button>
        </div>
      </div>
    </Modal>
  );
}
