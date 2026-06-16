'use client';

import { useEffect, useState } from 'react';
import { Input, Select, Button } from '@pinguin/ui';
import { api } from '@/lib/api';

interface Role {
  id: string;
  name: string;
}

interface FormTemplate {
  id: string;
  name: string;
}

export interface TicketCategoryData {
  id: string;
  name: string;
  description?: string;
  color?: string;
  emoji?: string;
  openingMode?: string;
  maxTicketsPerUser?: number;
  staffRoleIds?: string[];
  welcomeMessage?: string;
  formId?: string;
  supportRoleIds?: string[];
}

interface CategoryBuilderProps {
  guildId: string;
  category?: TicketCategoryData;
  onSave: () => void;
  onCancel: () => void;
}

const OPENING_MODES = [
  { value: 'BUTTON', label: 'Bouton' },
  { value: 'SELECT', label: 'Menu de sélection' },
  { value: 'FORM', label: 'Formulaire' },
] as const;

function parseRoleIds(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function CategoryBuilder({ guildId, category, onSave, onCancel }: CategoryBuilderProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('');
  const [color, setColor] = useState('#5865F2');
  const [staffRoleIds, setStaffRoleIds] = useState<string[]>([]);
  const [maxTicketsPerUser, setMaxTicketsPerUser] = useState(5);
  const [openingMode, setOpeningMode] = useState<'BUTTON' | 'SELECT' | 'FORM'>('BUTTON');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [formId, setFormId] = useState('');

  const [roles, setRoles] = useState<Role[]>([]);
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingForms, setLoadingForms] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditing = !!category;

  useEffect(() => {
    if (category) {
      setName(category.name ?? '');
      setDescription(category.description ?? '');
      setEmoji(category.emoji ?? '');
      setColor(category.color ?? '#5865F2');
      setStaffRoleIds(parseRoleIds(category.staffRoleIds));
      setMaxTicketsPerUser(category.maxTicketsPerUser ?? 5);
      setOpeningMode((category.openingMode ?? 'BUTTON') as 'BUTTON' | 'SELECT' | 'FORM');
      setWelcomeMessage(category.welcomeMessage ?? '');
      setFormId(category.formId ?? '');
    }
  }, [category]);

  useEffect(() => {
    if (!guildId) return;
    setLoadingRoles(true);
    api.get<{ success: boolean; data: { roles: Role[] } }>(`/api/guilds/${guildId}/roles`)
      .then((res) => {
        if (res.success && res.data) {
          setRoles(res.data.roles.filter((r: Role) => r.name !== '@everyone'));
        }
      })
      .catch(() => setRoles([]))
      .finally(() => setLoadingRoles(false));
  }, [guildId]);

  useEffect(() => {
    if (openingMode !== 'FORM') {
      setFormId('');
      return;
    }
    setLoadingForms(true);
    api.get<{ success: boolean; data: { settings: { templates: FormTemplate[] } } }>(`/api/guilds/${guildId}/forms`)
      .then((res) => {
        if (res.success && res.data) {
          setForms(res.data.settings?.templates ?? []);
        }
      })
      .catch(() => setForms([]))
      .finally(() => setLoadingForms(false));
  }, [guildId, openingMode]);

  const toggleRole = (roleId: string) => {
    setStaffRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name,
        description: description || null,
        emoji: emoji || null,
        color,
        staffRoleIds,
        maxTicketsPerUser,
        openingMode,
        welcomeMessage: welcomeMessage || null,
      };
      if (openingMode === 'FORM') body.formId = formId;
      else body.formId = null;

      if (isEditing) {
        await api.put(`/api/guilds/${guildId}/tickets/categories/${category.id}`, body);
      } else {
        await api.post(`/api/guilds/${guildId}/tickets/categories`, body);
      }
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          {isEditing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
        </h2>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={saving}>{isEditing ? 'Enregistrer' : 'Créer'}</Button>
        </div>
      </div>

      <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Support" required />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase">Description</label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description de la catégorie..."
          className="w-full px-3 py-2 text-sm text-[var(--text-primary)] rounded-[var(--radius-sm)] outline-none bg-transparent border border-[var(--border-color)] focus:border-[var(--accent)] placeholder:text-[var(--text-secondary)] resize-y"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🎫" maxLength={10} />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase">Couleur</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full h-9 px-1 py-1 rounded-[var(--radius-sm)] border border-[var(--border-color)] bg-transparent cursor-pointer"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase">Mode d'ouverture</label>
        <div className="flex gap-4">
          {OPENING_MODES.map((mode) => (
            <label key={mode.value} className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
              <input
                type="radio"
                name="openingMode"
                value={mode.value}
                checked={openingMode === mode.value}
                onChange={(e) => setOpeningMode(e.target.value as 'BUTTON' | 'SELECT' | 'FORM')}
                className="accent-[var(--accent)]"
              />
              {mode.label}
            </label>
          ))}
        </div>
      </div>

      {openingMode === 'FORM' && (
        <Select
          label="Template de formulaire"
          options={[
            { value: '', label: loadingForms ? 'Chargement…' : '— Sélectionner —' },
            ...forms.map((f) => ({ value: f.id, label: f.name })),
          ]}
          value={formId}
          onChange={(e) => setFormId(e.target.value)}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase">Rôles staff</label>
        {loadingRoles ? (
          <span className="text-sm text-[var(--text-secondary)]">Chargement des rôles…</span>
        ) : roles.length === 0 ? (
          <span className="text-sm text-[var(--text-secondary)]">Aucun rôle disponible</span>
        ) : (
          <div className="max-h-48 overflow-y-auto border border-[var(--border-color)] rounded-[var(--radius-sm)] p-2 space-y-1">
            {roles.map((role) => {
              const checked = staffRoleIds.includes(role.id);
              return (
                <label
                  key={role.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer transition-colors ${checked ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--bg-surface-alt)]'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRole(role.id)}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-[var(--text-primary)]">{role.name}</span>
                  <span className="text-[var(--text-secondary)] text-xs ml-auto">{role.id}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <Input
        label="Tickets max par utilisateur"
        type="number"
        min={1}
        value={String(maxTicketsPerUser)}
        onChange={(e) => setMaxTicketsPerUser(parseInt(e.target.value, 10) || 1)}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase">Message de bienvenue</label>
        <textarea
          rows={4}
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          placeholder="Bienvenue dans votre ticket ! L'équipe vous répondra sous peu."
          className="w-full px-3 py-2 text-sm text-[var(--text-primary)] rounded-[var(--radius-sm)] outline-none bg-transparent border border-[var(--border-color)] focus:border-[var(--accent)] placeholder:text-[var(--text-secondary)] resize-y"
        />
      </div>
    </form>
  );
}
