import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGuildFindMany = vi.hoisted(() => vi.fn());
const mockAuditCount = vi.hoisted(() => vi.fn());
const mockAuditGroupBy = vi.hoisted(() => vi.fn());
const mockBotFetch = vi.hoisted(() => vi.fn());

vi.mock('@pinguin/db', () => ({
  prisma: {
    guild: { findMany: mockGuildFindMany },
    auditLog: { count: mockAuditCount, groupBy: mockAuditGroupBy },
  },
  AuditAction: { MESSAGE_CREATE: 'MESSAGE_CREATE' },
}));

vi.mock('@pinguin/config', () => ({
  getConfig: vi.fn(() => ({ DISCORD_OWNER_ID: 'owner123' })),
}));

vi.mock('../services/bot-proxy', () => ({
  botFetch: mockBotFetch,
}));

vi.mock('../services/metrics', () => ({
  getSystemMetrics: vi.fn(() => ({
    cpu: 12.5,
    ram: { used: 2048, total: 8192, percent: 25 },
    uptime: 3600,
    processUptime: 1800,
    platform: 'linux',
    nodeVersion: 'v20.0.0',
    loadAvg: [1, 1, 1],
  })),
  getGlobalStats: vi.fn(() => ({
    guilds: 10,
    users: 500,
    totalXp: 100000,
    moderationCases: 50,
    premiumSubscriptions: 5,
  })),
}));

vi.mock('../middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _rep: any, done: () => void) => done()),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('computePublicOverview logic', () => {
  it('returns correct metrics when bot is online', async () => {
    mockGuildFindMany.mockResolvedValue([
      { id: 'g1', memberCount: 100 },
      { id: 'g2', memberCount: 200 },
    ]);
    mockAuditGroupBy.mockResolvedValue([{ guildId: 'g1' }, { guildId: 'g2' }, { guildId: 'g3' }]);
    mockAuditCount.mockResolvedValue(15);
    mockBotFetch.mockResolvedValue({ data: { onlineMembers: 42 } });

    const { computePublicOverview } = await import('../routes/overview');
    const result = await computePublicOverview();

    expect(result).toEqual({
      guildCount: 2,
      totalMembers: 300,
      onlineMembers: 42,
      activeGuilds: 3,
      messagesToday: 15,
    });
  });

  it('handles bot offline gracefully', async () => {
    mockGuildFindMany.mockResolvedValue([{ id: 'g1', memberCount: 50 }]);
    mockAuditGroupBy.mockResolvedValue([]);
    mockAuditCount.mockResolvedValue(0);
    mockBotFetch.mockRejectedValue(new Error('BOT_OFFLINE'));

    const { computePublicOverview } = await import('../routes/overview');
    const result = await computePublicOverview();

    expect(result).toEqual({
      guildCount: 1,
      totalMembers: 50,
      onlineMembers: 0,
      activeGuilds: 0,
      messagesToday: 0,
    });
  });
});
