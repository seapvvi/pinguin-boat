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
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetchGuildSettings(guildId)
      .then((res) => {
        if (res.success && res.data?.guild) {
          const disabled = res.data.guild.disabledModules ?? [];
          setEnabled(!disabled.map((m: string) => m.toLowerCase()).includes(moduleKey));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guildId, moduleKey]);

  const handleToggle = async (value: boolean) => {
    setToggling(true);
    try {
      await apiToggleModule(guildId, moduleKey, value);
      setEnabled(value);
    } catch {
      // revert on error
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-12 w-full rounded-[var(--radius-sm)]" />;
  }

  return (
    <div className="flex items-center justify-between p-4 rounded-[0px] border border-[var(--border-color)] bg-[var(--bg-surface)]">
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
        {description && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>}
      </div>
      <Toggle checked={enabled} onChange={handleToggle} disabled={toggling} />
    </div>
  );
}
