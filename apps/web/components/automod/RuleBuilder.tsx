'use client'

import { useState } from 'react'
import { Card, Toggle, Select, Button } from '@pinguin/ui'
import { classNames } from '@/lib/utils'
import {
  type AutoModRule,
  type RuleType,
  type RuleAction,
  RULE_LABELS,
  simulateRule,
} from '@/lib/automod-rules'

interface RuleBuilderProps {
  rules: AutoModRule[]
  onChange: (rules: AutoModRule[]) => void
}

const ACTIONS: { value: RuleAction; label: string }[] = [
  { value: 'WARN', label: 'Avertissement' },
  { value: 'MUTE', label: 'Mute temporaire' },
  { value: 'KICK', label: 'Expulsion' },
  { value: 'BAN', label: 'Bannissement' },
]

export function RuleBuilder({ rules, onChange }: RuleBuilderProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [simulated, setSimulated] = useState<string | null>(null)

  const updateRule = (id: string, patch: Partial<AutoModRule>) => {
    onChange(rules.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  const ruleTypes: RuleType[] = ['SPAM', 'CAPS', 'LINKS', 'MENTIONS', 'BANNED_WORDS', 'EMOJIS']
  const enabledCount = rules.filter(r => r.enabled).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-[var(--text-primary)]">
          Règles activées : {enabledCount}/6
        </h2>
      </div>
      {ruleTypes.map((type) => {
        const rule = rules.find(r => r.type === type)!
        const isOpen = expanded === rule.id

        return (
          <Card key={rule.id} className={classNames('p-4', isOpen && 'ring-1 ring-[var(--accent)]')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Toggle
                  checked={rule.enabled}
                  onChange={(v) => updateRule(rule.id, { enabled: v })}
                />
                <button
                  type="button"
                  className="text-sm font-medium text-[var(--text-primary)] truncate hover:text-[var(--accent)] transition-colors cursor-pointer bg-transparent border-none text-left"
                  onClick={() => setExpanded(isOpen ? null : rule.id)}
                >
                  {RULE_LABELS[type]}
                </button>
              </div>
              {simulated === rule.id && (
                <span className="text-xs text-[var(--text-secondary)] mr-2">{simulateRule(rule)}</span>
              )}
            </div>

            {isOpen && rule.enabled && (
              <div className="mt-4 space-y-4 border-t border-[var(--border-color)] pt-4">
                {type === 'SPAM' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                        Seuil : {rule.threshold} messages
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={50}
                        value={rule.threshold}
                        onChange={(e) => updateRule(rule.id, { threshold: Number(e.target.value) })}
                        className="w-full accent-[var(--accent)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                        Intervalle : {rule.interval}s
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={120}
                        value={rule.interval}
                        onChange={(e) => updateRule(rule.id, { interval: Number(e.target.value) })}
                        className="w-full accent-[var(--accent)]"
                      />
                    </div>
                  </div>
                )}

                {type === 'CAPS' && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                      Seuil : {rule.threshold}% de majuscules
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={rule.threshold}
                      onChange={(e) => updateRule(rule.id, { threshold: Number(e.target.value) })}
                      className="w-full accent-[var(--accent)]"
                    />
                  </div>
                )}

                {type === 'MENTIONS' && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                      Seuil : {rule.threshold} mentions
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      value={rule.threshold}
                      onChange={(e) => updateRule(rule.id, { threshold: Number(e.target.value) })}
                      className="w-full accent-[var(--accent)]"
                    />
                  </div>
                )}

                {type === 'EMOJIS' && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                      Seuil : {rule.threshold} emojis
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      value={rule.threshold}
                      onChange={(e) => updateRule(rule.id, { threshold: Number(e.target.value) })}
                      className="w-full accent-[var(--accent)]"
                    />
                  </div>
                )}

                {(type === 'LINKS' || type === 'BANNED_WORDS') && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                      Seuil d&apos;infractions avant sanction : {rule.threshold}
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      value={rule.threshold}
                      onChange={(e) => updateRule(rule.id, { threshold: Number(e.target.value) })}
                      className="w-full accent-[var(--accent)]"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Action"
                    options={ACTIONS}
                    value={rule.action}
                    onChange={(e) => updateRule(rule.id, { action: e.target.value as RuleAction })}
                  />
                  {rule.action === 'MUTE' && (
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                        Durée (minutes)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={40320}
                        value={rule.actionDuration ?? 10}
                        onChange={(e) => updateRule(rule.id, { actionDuration: Number(e.target.value) || 10 })}
                        className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] [color-scheme:dark]"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSimulated(simulated === rule.id ? null : rule.id)}
                  >
                    {simulated === rule.id ? 'Masquer' : 'Simuler'}
                  </Button>
                  {simulated === rule.id && (
                    <div className="flex-1 flex items-center px-3 py-1.5 text-sm text-[var(--text-secondary)] bg-[var(--bg-surface-alt)]/50 rounded-[var(--radius-sm)] border border-[var(--border-color)]">
                      {simulateRule(rule)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isOpen && !rule.enabled && (
              <div className="mt-3 text-xs text-[var(--text-secondary)] italic border-t border-[var(--border-color)] pt-3">
                Règle désactivée — activez le toggle pour configurer
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
