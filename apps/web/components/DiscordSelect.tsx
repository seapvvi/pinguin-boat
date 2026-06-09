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
            const mapped = res.data.channels
                .filter((c) => channelTypes.includes((c as { type: number }).type))
                .map((c) => ({
                  value: (c as { id: string }).id,
                  label: `#${(c as { name: string }).name}`,
                }));
            setOptions(mapped);
            if (!value && mapped.length > 0) onChange(mapped[0].value);
          }
        } else {
          const res = await fetchGuildRoles(guildId);
          if (res.success && res.data) {
            const mapped = res.data.roles
                .filter((r) => (r as { name: string }).name !== '@everyone')
                .map((r) => ({
                  value: (r as { id: string }).id,
                  label: (r as { name: string }).name,
                }));
            setOptions(mapped);
            if (!value && mapped.length > 0) onChange(mapped[0].value);
          }
        }
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [guildId, type, channelTypes.join(','), value, onChange]);

  return (
    <Select
      label={label ?? (type === 'channel' ? 'Salon' : 'Rôle')}
      options={[{ value: '', label: loading ? 'Chargement…' : placeholder ?? '— Sélectionner —' }, ...options]}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
