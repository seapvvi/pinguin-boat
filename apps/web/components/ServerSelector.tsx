'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@pinguin/ui';
import type { GuildItemDTO } from '@pinguin/shared';
import { fetchGuilds } from '@/lib/api';
import { Server, Search, Check, ChevronDown } from 'lucide-react';

interface ServerSelectorProps {
  guildId: string;
}

export default function ServerSelector({ guildId }: ServerSelectorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [guilds, setGuilds] = useState<GuildItemDTO[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && guilds.length === 0) {
      setLoading(true);
      fetchGuilds()
        .then((res) => {
          if (res.success && res.data) {
            setGuilds(res.data.guilds);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, guilds.length]);

  const currentGuild = guilds.find((g) => g.id === guildId);

  const filtered = guilds.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (id: string) => {
    setOpen(false);
    setSearch('');
    router.push(`/servers/${id}/overview`);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 13,
          maxWidth: 200,
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {currentGuild ? (
          <>
            <Avatar
              src={
                currentGuild.icon
                  ? `https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.png?size=32`
                  : undefined
              }
              name={currentGuild.name}
              size={20}
            />
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'var(--text-primary)',
              }}
            >
              {currentGuild.name}
            </span>
          </>
        ) : (
          <>
            <Server size={16} />
            <span>Sélectionner</span>
          </>
        )}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: 4,
            width: 280,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            overflow: 'hidden',
            zIndex: 60,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <Search size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                background: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {loading && (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                Chargement…
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                Aucun serveur trouvé
              </div>
            )}

            {!loading &&
              filtered.map((g) => {
                const isSelected = g.id === guildId;
                return (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => handleSelect(g.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      background: isSelected ? 'var(--bg-surface-alt)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: 13,
                      textAlign: 'left',
                      transition: 'background-color 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isSelected
                        ? 'var(--bg-surface-alt)'
                        : 'transparent';
                    }}
                  >
                    <Avatar
                      src={
                        g.icon
                          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=32`
                          : undefined
                      }
                      name={g.name}
                      size={28}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: isSelected ? 500 : 400,
                        }}
                      >
                        {g.name}
                      </div>
                      {g.botPresent && (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--success)',
                            marginTop: 1,
                          }}
                        >
                          Bot présent
                        </div>
                      )}
                    </div>
                    {isSelected && <Check size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
