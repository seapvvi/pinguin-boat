'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Card, Input, Select, Skeleton, Badge, Table, type Column } from '@pinguin/ui'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'

interface AutoModEntry {
  id: string
  userId: string
  username: string | null
  action: string
  reason: string | null
  type: string
  channelId: string | null
  createdAt: string
}

interface Props {
  guildId: string
}

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'CAPS', label: 'Majuscules' },
  { value: 'LINKS', label: 'Liens' },
  { value: 'MENTIONS', label: 'Mentions' },
  { value: 'BANNED_WORDS', label: 'Mots interdits' },
  { value: 'EMOJIS', label: 'Emojis' },
]

const ACTION_LABELS: Record<string, string> = {
  WARN: 'Avertissement',
  MUTE: 'Mute',
  KICK: 'Expulsion',
  BAN: 'Bannissement',
  DELETE: 'Suppression',
}

const ACTION_VARIANTS: Record<string, 'warning' | 'error' | 'info' | 'default'> = {
  WARN: 'warning',
  MUTE: 'info',
  KICK: 'error',
  BAN: 'error',
  DELETE: 'default',
}

export function AutoModHistory({ guildId }: Props) {
  const [entries, setEntries] = useState<AutoModEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const load = async (p: number) => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(p), perPage: '20' }
      if (typeFilter) params.type = typeFilter
      const res = await api.get<{ data: { entries: AutoModEntry[]; pagination: { totalPages: number } } }>(
        `/api/guilds/${guildId}/automod/history`,
        params
      )
      if (res?.data) {
        setEntries(res.data.entries || [])
        setTotalPages(res.data.pagination?.totalPages || 1)
      }
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setPage(1) }, [typeFilter])
  useEffect(() => { load(page) }, [guildId, typeFilter, page])

  const columns: Column<AutoModEntry>[] = [
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (item) => formatDate(item.createdAt),
    },
    {
      key: 'type',
      label: 'Type',
      render: (item) => <Badge>{item.type}</Badge>,
    },
    {
      key: 'userId',
      label: 'Utilisateur',
      render: (item) => item.username || item.userId,
    },
    {
      key: 'action',
      label: 'Action',
      render: (item) => (
        <Badge variant={ACTION_VARIANTS[item.action] || 'default'}>
          {ACTION_LABELS[item.action] || item.action}
        </Badge>
      ),
    },
    {
      key: 'reason',
      label: 'Raison',
      render: (item) => item.reason || '—',
    },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-48">
          <Select
            label="Filtrer par type"
            options={TYPE_OPTIONS}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          />
        </div>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          <Table
            columns={columns}
            data={entries}
            keyExtractor={(e) => e.id}
            emptyMessage="Aucune entrée d'auto-modération"
          />
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-3 py-1 text-sm text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[var(--radius-sm)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Précédent
          </button>
          <span className="text-sm text-[var(--text-secondary)]">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 text-sm text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[var(--radius-sm)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Suivant
          </button>
        </div>
      )}
    </motion.div>
  )
}
