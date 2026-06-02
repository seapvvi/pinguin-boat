'use client';
import { Select } from '@pinguin/ui';

interface StepModRoleProps {
  modRoleId: string;
  roles: { id: string; name: string }[];
  onChange: (roleId: string) => void;
}

export function StepModRole({ modRoleId, roles, onChange }: StepModRoleProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Ce rôle donnera accès aux commandes de modération du bot.
      </p>
      <Select
        label="Rôle modérateur"
        value={modRoleId}
        onChange={(e) => onChange(e.target.value)}
        options={[
          { value: '', label: '— Sélectionner un rôle —' },
          ...roles.map((r) => ({ value: r.id, label: r.name })),
        ]}
      />
    </div>
  );
}
