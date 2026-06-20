'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { ShieldOff } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Permissions supportées par PermissionGate.
 * - discord.xxx = permission native Discord
 * - module.xxx = permission de module du dashboard Pinguin
 */
export type PermKey = 'manageGuild' | 'manageRoles' | 'manageMessages' | `module.${string}`;

interface PermissionGateProps {
  permission: PermKey;
  children: React.ReactNode;
}

interface PermsResponse {
  isOwner: boolean;
  isAdmin: boolean;
  can: Record<string, boolean>;
  dashboard: Record<string, boolean>;
}

export function PermissionGate({ permission, children }: PermissionGateProps) {
  const params = useParams<{ guildId?: string }>();
  const guildId = params?.guildId;
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!guildId) { setLoading(false); setAllowed(false); return; }

    const timeout = setTimeout(() => {
      setLoading(false);
      setAllowed(true);
    }, 5000);

    api.get<{ data: PermsResponse }>(`/api/guilds/${guildId}/my-permissions`)
      .then((res) => {
        const d = (res as { data?: PermsResponse })?.data;
        if (!d) { setAllowed(false); return; }
        if (d.isOwner || d.isAdmin) { setAllowed(true); return; }
        // Permission Discord native (manageGuild, manageRoles, manageMessages)
        if (d.can?.[permission]) { setAllowed(true); return; }
        // Permission de module (module.moderation, module.tickets, etc.)
        if (permission.startsWith('module.')) {
          const moduleKey = permission.slice(7);
          if (d.dashboard?.[moduleKey]) { setAllowed(true); return; }
        }
      })
      .catch(() => { setAllowed(true); })
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });
  }, [guildId, permission]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center gap-4 py-16 text-center"
      >
        <div className="w-14 h-14 rounded-[var(--radius)] bg-[var(--error)]/10 flex items-center justify-center">
          <ShieldOff size={28} className="text-[var(--error)]" />
        </div>
        <div>
          <p className="text-base font-semibold text-[var(--text-primary)]">Accès refusé</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Vous n&apos;avez pas les permissions nécessaires pour accéder à cette page.
          </p>
        </div>
      </motion.div>
    );
  }

  return <>{children}</>;
}
