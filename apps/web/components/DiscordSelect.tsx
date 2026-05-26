'use client';

import { useEffect, useState } from 'react';
import { Select } from '@pinguin/ui';
import { fetchGuildChannels, fetchGuildRoles } from '@/lib/api';

type SelectType = 'channel' | 'role';

interface DiscordSelectProps {
  type: SelectType;
  guildId: string;
  value: string;
  onChange: (id: string) => void;
  label?: string;
  placeholder?: string;
  channelTypes?: number[];
}

export function DiscordSelect({
  type,
  guildId,
  value,
  onChange,
  label,
  placeholder,
  channelTypes = [0, 2, 4],
}: DiscordSelectProps) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!guildId) return;
    setLoading(true);
    const load = async () => {
      try {
        if (type === 'channel') {
          const res = await fetchGuildChannels(guildId);
          if (res.success && res.data) {
            setOptions(
              res.data.channels
                .filter((c: { type: number }) => channelTypes.includes(c.type))
                .map((c: { id: string; name: string }) => ({
                  value: c.id,
                  label: `#${c.name}`,
                }))
            );
          }
        } else {
          const res = await fetchGuildRoles(guildId);
          if (res.success && res.data) {
            setOptions(
              res.data.roles
                .filter((r: { name: string }) => r.name !== '@everyone')
                .map((r: { id: string; name: string }) => ({
                  value: r.id,
                  label: r.name,
                }))
            );
          }
        }
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [guildId, type, channelTypes.join(',')]);

  return (
    <Select
      label={label ?? (type === 'channel' ? 'Salon' : 'Rôle')}
      options={[{ value: '', label: loading ? 'Chargement…' : placeholder ?? '— Sélectionner —' }, ...options]}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
