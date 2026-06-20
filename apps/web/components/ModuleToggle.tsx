'use client';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Toggle, Skeleton } from '@pinguin/ui';
import { fetchGuildSettings, toggleModule as apiToggleModule } from '@/lib/api';

const KEY_MAP: Record<string, string> = {
  automod: 'moderation',
};

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
  const rawKey = moduleKey.trim().toLowerCase();
  const normalizedModuleKey = KEY_MAP[rawKey] ?? rawKey;

  useEffect(() => {
    fetchGuildSettings(guildId)
      .then((res) => {
        if (res.success && res.data?.guild) {
          const disabled = res.data.guild.disabledModules ?? [];
          setEnabled(!disabled.map((m: string) => m.toLowerCase()).includes(normalizedModuleKey));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [guildId, normalizedModuleKey]);

  const handleToggle = async (value: boolean) => {
    const previous = enabled;
    setEnabled(value);
    setToggling(true);
    setError(null);
    try {
      await apiToggleModule(guildId, normalizedModuleKey, value);
      toast.success(value ? `${label} activé` : `${label} désactivé`);
      // PAS de re-fetch ici — l'optimistic update suffit
    } catch (e) {
      setEnabled(previous);
      const msg = e instanceof Error ? e.message : 'Erreur lors de la mise à jour';
      const is404 = msg.includes('404') || msg.includes('Not Found') || msg.includes('not found');
      toast.error(is404
        ? `Module "${label}" introuvable. Contactez le support.`
        : msg
      );
      setError(is404 ? `Route introuvable pour le module "${moduleKey}"` : msg);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-12 w-full rounded-[var(--radius-sm)]" />;
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-between p-4 border border-[var(--border-color)] bg-[var(--bg-surface)]"
      >
        <div className="flex items-center gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
            {description && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>}
          </div>
          {enabled && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-green-400 animate-ping" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-green-400" />
              </span>
              <span className="text-[10px] font-medium text-green-400">Actif</span>
            </div>
          )}
        </div>
        {enabled !== null && <Toggle checked={enabled} onChange={handleToggle} disabled={toggling} />}
      </motion.div>
      {error && <p className="text-xs text-[var(--error)] mt-1">{error}</p>}
    </div>
  );
}
