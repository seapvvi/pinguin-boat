'use client';
import { useState, useEffect } from 'react';
import { Toggle, Skeleton } from '@pinguin/ui';
import { fetchGuildSettings, toggleModule as apiToggleModule } from '@/lib/api';

interface ModuleToggleProps {
  guildId: string;
  moduleKey: string;
  label: string;
  description?: string;
}

export function ModuleToggle({ guildId, moduleKey, label, description }: ModuleToggleProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGuildSettings(guildId)
      .then((res) => {
        if (res.success && res.data?.guild) {
          const disabled = res.data.guild.disabledModules ?? [];
          setEnabled(!disabled.map((m: string) => m.toLowerCase()).includes(moduleKey));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [guildId, moduleKey]);

  const normalizedModuleKey = moduleKey.trim().toLowerCase();

  const handleToggle = async (value: boolean) => {
    setToggling(true);
    setError(null);
    try {
      await apiToggleModule(guildId, normalizedModuleKey, value);
      setEnabled(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la mise à jour');
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-12 w-full rounded-[var(--radius-sm)]" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between p-4 rounded-[0px] border border-[var(--border-color)] bg-[var(--bg-surface)]">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
          {description && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>}
        </div>
        {enabled !== null && <Toggle checked={enabled} onChange={handleToggle} disabled={toggling} />}
      </div>
      {error && <p className="text-xs text-[var(--error)] mt-1">{error}</p>}
    </div>
  );
}
