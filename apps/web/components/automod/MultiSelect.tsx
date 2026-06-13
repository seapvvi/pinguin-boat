'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchGuildChannels, fetchGuildRoles } from '@/lib/api'

interface SelectItem {
  id: string
  name: string
}

interface MultiSelectProps {
  type: 'channel' | 'role'
  guildId: string
  value: string[]
  onChange: (ids: string[]) => void
  label: string
  adminWarning?: boolean
}

export function MultiSelect({ type, guildId, value, onChange, label, adminWarning }: MultiSelectProps) {
  const [items, setItems] = useState<SelectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (type === 'channel') {
        const res = await fetchGuildChannels(guildId)
        if (res.success && res.data) {
          setItems(
            res.data.channels
              .filter((c: any) => [0, 2, 4, 5].includes(Number(c.type)))
              .map((c: any) => ({ id: String(c.id), name: `#${String(c.name)}` }))
          )
        }
      } else {
        const res = await fetchGuildRoles(guildId)
        if (res.success && res.data) {
          setItems(
            res.data.roles
              .filter((r: any) => String(r.name) !== '@everyone')
              .map((r: any) => ({ id: String(r.id), name: String(r.name) }))
          )
        }
      }
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [guildId, type])

  useEffect(() => { load() }, [load])

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id])
  }

  const isAdminRole = (name: string) =>
    ['admin', 'administrator', 'fondateur', 'owner'].some(kw =>
      name.toLowerCase().includes(kw)
    )

  return (
    <div className="relative">
      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] tracking-widest uppercase mb-1.5">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-sm text-left text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-color)] outline-none focus:outline-2 focus:outline-[var(--accent-primary)] focus:outline-offset-0 cursor-pointer"
        style={{ height: 'var(--input-height)', paddingLeft: 'var(--input-padding-x)', paddingRight: 'var(--input-padding-x)', borderRadius: 0 }}
      >
        <span className={value.length === 0 ? 'text-[var(--text-secondary)]' : ''}>
          {value.length === 0
            ? loading ? 'Chargement…' : 'Aucun sélectionné'
            : `${value.length} sélectionné${value.length > 1 ? 's' : ''}`}
        </span>
        <svg
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          width="12" height="12" viewBox="0 0 12 12" fill="none"
        >
          <path d="M3 5L6 8L9 5" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border-color)]">
          {loading ? (
            <div className="p-3 text-sm text-[var(--text-secondary)]">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="p-3 text-sm text-[var(--text-secondary)]">Aucun élément</div>
          ) : (
            items.map((item) => {
              const selected = value.includes(item.id)
              const isAdmin = type === 'role' && isAdminRole(item.name)
              return (
                <div key={item.id} className="flex flex-col">
                  <label className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-surface-alt)]/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggle(item.id)}
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-sm text-[var(--text-primary)]">{item.name}</span>
                    {isAdmin && selected && (
                      <span className="ml-auto text-[10px] text-[var(--warning)]">Admin</span>
                    )}
                  </label>
                  {isAdmin && selected && adminWarning && (
                    <div className="px-3 pb-2 text-[11px] text-[var(--warning)]">
                      Les administrateurs sont toujours exemptés automatiquement
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
