'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Ticket, Wallet, Trophy, DoorOpen, UserPlus, ScrollText,
  Swords, FileText, Gift, Vote, Lightbulb, Music2, ChevronDown, X,
} from 'lucide-react';
import { Card, Button } from '@pinguin/ui';
import { fetchGuildRoles } from '@/lib/api';

interface ModulePermissionsProps {
  guildId: string;
  values: Record<string, string[]>;
  onChange: (module: string, roleIds: string[]) => void;
}

const MODULES = [
  { key: 'moderation', label: 'Modération', icon: Shield },
  { key: 'tickets', label: 'Tickets', icon: Ticket },
  { key: 'economy', label: 'Économie', icon: Wallet },
  { key: 'levels', label: 'Niveaux / XP', icon: Trophy },
  { key: 'welcome', label: 'Bienvenue', icon: DoorOpen },
  { key: 'autoroles', label: 'Auto-rôles', icon: UserPlus },
  { key: 'logs', label: 'Logs', icon: ScrollText },
  { key: 'protection', label: 'Protection', icon: Swords },
  { key: 'audit', label: 'Audit', icon: FileText },
  { key: 'giveaways', label: 'Giveaways', icon: Gift },
  { key: 'polls', label: 'Sondages', icon: Vote },
  { key: 'suggestions', label: 'Suggestions', icon: Lightbulb },
  { key: 'music', label: 'Musique', icon: Music2 },
];

interface RoleOption {
  id: string;
  name: string;
  color: string;
}

function RoleMultiSelect({
  roles,
  selected,
  onChange,
  label,
}: {
  roles: RoleOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleRole = (roleId: string) => {
    if (selected.includes(roleId)) {
      onChange(selected.filter((id) => id !== roleId));
    } else {
      onChange([...selected, roleId]);
    }
  };

  const selectedNames = roles
    .filter((r) => selected.includes(r.id))
    .map((r) => r.name);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-left text-[var(--text-primary)] border border-[var(--border-color)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)] hover:border-[var(--accent)] transition-colors"
      >
        <span className="truncate flex-1">
          {selected.length === 0 ? (
            <span className="text-[var(--text-secondary)]">Aucun rôle (admins uniquement)</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {selectedNames.slice(0, 3).join(', ')}
              {selectedNames.length > 3 && ` +${selectedNames.length - 3}`}
            </span>
          )}
        </span>
        <ChevronDown size={14} className={`ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto border border-[var(--border-color)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)] shadow-lg"
          >
            {roles.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[var(--text-secondary)]">Chargement des rôles…</div>
            ) : (
              roles.map((role) => {
                const isSelected = selected.includes(role.id);
                return (
                  <label
                    key={role.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-[var(--bg-surface-alt)] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRole(role.id)}
                      className="accent-[var(--accent)]"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: role.color || '#99aab5' }}
                    />
                    <span className="text-[var(--text-primary)] truncate">{role.name}</span>
                  </label>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ModulePermissions({ guildId, values, onChange }: ModulePermissionsProps) {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!guildId) return;
    setLoading(true);
    fetchGuildRoles(guildId)
      .then((res) => {
        if (res.success && res.data) {
          const mapped = res.data.roles
            .filter((r: any) => String(r.name) !== '@everyone')
            .map((r: any) => ({
              id: String(r.id),
              name: String(r.name),
              color: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : '#99aab5',
            }));
          setRoles(mapped);
        }
      })
      .catch(() => setRoles([]))
      .finally(() => setLoading(false));
  }, [guildId]);

  return (
    <Card className="space-y-5 p-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--text-primary)]">Permissions par module du dashboard</h2>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Ces rôles permettent d&apos;accéder à cette section du dashboard.
          Les administrateurs Discord ont toujours accès à tout.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--text-secondary)]">Chargement des rôles…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <div key={mod.key} className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                  <Icon size={16} className="text-[var(--accent)]" />
                  <span>{mod.label}</span>
                </div>
                <RoleMultiSelect
                  roles={roles}
                  selected={values[mod.key] ?? []}
                  onChange={(ids) => onChange(mod.key, ids)}
                  label={mod.label}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-surface-alt)] rounded-[var(--radius-sm)] p-3">
        <strong>Note :</strong> Si vous retirez votre propre rôle des permissions d&apos;un module,
        vous perdrez l&apos;accès à cette section. Les administrateurs Discord (permission
        <code className="mx-1 px-1 py-0.5 bg-[var(--bg-surface)] rounded text-[var(--accent)]">ADMINISTRATOR</code>)
        ne sont jamais bloqués.
      </div>
    </Card>
  );
}
