export type RuleType = 'SPAM' | 'CAPS' | 'LINKS' | 'MENTIONS' | 'BANNED_WORDS' | 'EMOJIS'
export type RuleAction = 'WARN' | 'MUTE' | 'KICK' | 'BAN'

export interface AutoModRule {
  id: string
  type: RuleType
  enabled: boolean
  threshold: number
  interval: number
  action: RuleAction
  actionDuration?: number
}

const ACTION_PRIORITY: RuleAction[] = ['BAN', 'KICK', 'MUTE', 'WARN']

function resolveAction(settings: Record<string, unknown>): RuleAction {
  if (settings.banEnabled) return 'BAN'
  if (settings.kickEnabled) return 'KICK'
  if (settings.muteEnabled) return 'MUTE'
  return 'WARN'
}

export function settingsToRules(settings: Record<string, unknown>): AutoModRule[] {
  const action = resolveAction(settings)
  const rules: AutoModRule[] = [
    {
      id: 'spam',
      type: 'SPAM',
      enabled: !!settings.messageSpam,
      threshold: (settings.spamThreshold as number) ?? 5,
      interval: (settings.spamInterval as number) ?? 5,
      action,
    },
    {
      id: 'caps',
      type: 'CAPS',
      enabled: !!settings.excessiveCaps,
      threshold: (settings.capsThreshold as number) ?? 70,
      interval: 0,
      action,
    },
    {
      id: 'links',
      type: 'LINKS',
      enabled: !!settings.externalLinks,
      threshold: (settings.autoSanctionThreshold as number) ?? 3,
      interval: 0,
      action,
    },
    {
      id: 'mentions',
      type: 'MENTIONS',
      enabled: !!settings.excessiveMentions,
      threshold: (settings.mentionsThreshold as number) ?? 5,
      interval: 0,
      action,
    },
    {
      id: 'banned_words',
      type: 'BANNED_WORDS',
      enabled: !!settings.bannedWords,
      threshold: (settings.autoSanctionThreshold as number) ?? 3,
      interval: 0,
      action,
    },
    {
      id: 'emojis',
      type: 'EMOJIS',
      enabled: !!settings.excessiveEmojis,
      threshold: (settings.emojisThreshold as number) ?? 10,
      interval: 0,
      action,
    },
  ]
  if (action === 'MUTE') {
    for (const r of rules) {
      r.actionDuration = (settings.muteDuration as number) ?? 10
    }
  }
  return rules
}

export function rulesToSettings(rules: AutoModRule[]): Record<string, unknown> {
  let hasBan = false
  let hasKick = false
  let hasMute = false
  let hasWarn = false
  let muteDuration: number | undefined

  for (const rule of rules) {
    if (!rule.enabled) continue
    if (rule.action === 'BAN') hasBan = true
    if (rule.action === 'KICK') hasKick = true
    if (rule.action === 'MUTE') {
      hasMute = true
      if (rule.actionDuration != null) muteDuration = rule.actionDuration
    }
    if (rule.action === 'WARN') hasWarn = true
  }

  const spam = rules.find(r => r.type === 'SPAM')
  const caps = rules.find(r => r.type === 'CAPS')
  const links = rules.find(r => r.type === 'LINKS')
  const mentions = rules.find(r => r.type === 'MENTIONS')
  const bannedWords = rules.find(r => r.type === 'BANNED_WORDS')
  const emojis = rules.find(r => r.type === 'EMOJIS')

  return {
    messageSpam: spam?.enabled ?? false,
    spamThreshold: Math.max(1, spam?.threshold ?? 5),
    spamInterval: Math.max(1, spam?.interval ?? 5),
    excessiveCaps: caps?.enabled ?? false,
    capsThreshold: Math.min(100, Math.max(1, caps?.threshold ?? 70)),
    externalLinks: links?.enabled ?? false,
    excessiveMentions: mentions?.enabled ?? false,
    mentionsThreshold: Math.max(1, mentions?.threshold ?? 5),
    bannedWords: bannedWords?.enabled ?? false,
    excessiveEmojis: emojis?.enabled ?? false,
    emojisThreshold: Math.max(1, emojis?.threshold ?? 10),
    banEnabled: hasBan,
    kickEnabled: hasKick,
    muteEnabled: hasMute,
    warnEnabled: hasWarn || (!hasBan && !hasKick && !hasMute),
    muteDuration: muteDuration ?? 10,
    autoSanctionThreshold: Math.max(
      1,
      ...rules
        .filter(r => r.type === 'BANNED_WORDS' || r.type === 'LINKS')
        .map(r => r.threshold),
      (spam?.threshold ?? 5),
    ),
  }
}

export function simulateRule(rule: AutoModRule): string {
  const typeLabel: Record<RuleType, string> = {
    SPAM: 'messages',
    CAPS: '% de majuscules',
    LINKS: 'liens externes',
    MENTIONS: 'mentions',
    BANNED_WORDS: 'mots interdits',
    EMOJIS: 'emojis',
  }
  const actionLabel: Record<RuleAction, string> = {
    WARN: 'avertissement',
    MUTE: `mute ${rule.actionDuration ? `${rule.actionDuration} min` : ''}`,
    KICK: 'expulsion',
    BAN: 'bannissement',
  }
  const interval = rule.interval > 0 ? ` en ${rule.interval} secondes` : ''
  return `Si ${rule.threshold} ${typeLabel[rule.type]}${interval} → ${actionLabel[rule.action]}`
}

export const RULE_LABELS: Record<RuleType, string> = {
  SPAM: 'Spam de messages',
  CAPS: 'Majuscules excessives',
  LINKS: 'Liens externes',
  MENTIONS: 'Mentions excessives',
  BANNED_WORDS: 'Mots interdits',
  EMOJIS: 'Emojis excessifs',
}
