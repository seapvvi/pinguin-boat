'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { ShieldOff } from 'lucide-react';
import { Skeleton } from '@pinguin/ui';
import { api } from '@/lib/api';

type PermKey = 'manageGuild' | 'manageRoles' | 'manageMessages';

interface PermissionGateProps {
  permission: PermKey;
  children: React.ReactNode;
}

interface PermsResponse {
  isOwner: boolean;
  isAdmin: boolean;
  can: Record<PermKey, boolean>;
}

export function PermissionGate({ permission, children }: PermissionGateProps) {
  const params = useParams<{ guildId?: string }>();
  const guildId = params?.guildId;
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!guildId) { setLoading(false); setAllowed(false); return; }
    api.get<{ data: PermsResponse }>(`/api/guilds/${guildId}/my-permissions`)
      .then((res) => {
        const d = (res as any)?.data as PermsResponse | undefined;
        if (d?.isOwner || d?.isAdmin || d?.can?.[permission]) {
          setAllowed(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guildId, permission]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-[var(--radius)]" />
        ))}
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
