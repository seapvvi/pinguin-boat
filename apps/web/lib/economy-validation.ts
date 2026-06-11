export const ECONOMY_LIMITS = {
  dailyAmount:     { min: 1,    max: 100000 },
  weeklyAmount:    { min: 1,    max: 500000 },
  startupBalance:  { min: 0,    max: 10000  },
  workMin:         { min: 1,    max: 10000  },
  workMax:         { min: 1,    max: 50000  },
  workCooldown:    { min: 60,   max: 86400  },
  robberyMaxAmount:{ min: 1,    max: 100000 },
  robberyCooldown: { min: 300,  max: 86400  },
  interestRate:    { min: 0,    max: 100    },
  interestInterval:{ min: 3600, max: 604800 },
  bankCapacity:    { min: 1000, max: 10000000},
} as const

export function validateEconomySettings(data: Record<string, number>): Record<string, string> {
  const errors: Record<string, string> = {}

  for (const [key, limits] of Object.entries(ECONOMY_LIMITS)) {
    const value = data[key]
    if (value === undefined) continue
    if (value < limits.min) errors[key] = `Minimum: ${limits.min}`
    else if (value > limits.max) errors[key] = `Maximum: ${limits.max}`
  }

  if (data.workMin !== undefined && data.workMax !== undefined && data.workMax < data.workMin) {
    errors.workMax = 'Doit être ≥ Travail min'
  }

  return errors
}
