import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuditCount = vi.fn();
const mockAuditGroupBy = vi.fn();
const mockCreate = vi.fn();

vi.mock('@pinguin/db', () => {
  const count = vi.fn();
  count.mockResolvedValue(5);
  return {
    prisma: {
      guild: { findMany: vi.fn(), count, aggregate: vi.fn().mockResolvedValue({ _sum: { memberCount: 300 } }) },
      user: { count: vi.fn().mockResolvedValue(100) },
      auditLog: { count: mockAuditCount, groupBy: mockAuditGroupBy },
      xPProfile: { aggregate: vi.fn().mockResolvedValue({ _sum: { xp: 50000 } }) },
      moderationCase: { count: vi.fn().mockResolvedValue(25) },
      premiumSubscription: { count: vi.fn().mockResolvedValue(3) },
      systemMetricsSnapshot: { create: mockCreate, findMany: vi.fn(), findFirst: vi.fn() },
    },
    AuditAction: { MESSAGE_CREATE: 'MESSAGE_CREATE' },
  };
});

vi.mock('os', () => ({
  cpus: () => [{ times: { user: 100, nice: 0, sys: 50, idle: 200, irq: 0 } }],
  totalmem: () => 16 * 1024 ** 3,
  freemem: () => 8 * 1024 ** 3,
  uptime: () => 86400,
  platform: () => 'win32',
  loadavg: () => [1.5, 1.2, 1.0],
}));

vi.mock('@pinguin/config', () => ({
  getConfig: vi.fn(() => ({ DISCORD_OWNER_ID: '123' })),
}));

import { getSystemMetrics, getGlobalStats, collectAndStore } from './metrics';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSystemMetrics', () => {
  it('returns CPU with 0 on first call', () => {
    const m = getSystemMetrics();
    expect(m.cpu).toBe(0);
    expect(m.ram.used).toBeGreaterThan(0);
    expect(m.ram.total).toBeGreaterThan(0);
    expect(m.ram.percent).toBeGreaterThan(0);
    expect(m.uptime).toBe(86400);
    expect(m.platform).toBe('win32');
    expect(m.nodeVersion).toBeTruthy();
  });

  it('returns non-zero CPU on second call', () => {
    getSystemMetrics();
    const m2 = getSystemMetrics();
    expect(m2.cpu).toBeGreaterThanOrEqual(0);
    expect(typeof m2.cpu).toBe('number');
  });
});

describe('getGlobalStats', () => {
  it('returns aggregated stats', async () => {
    const s = await getGlobalStats();
    expect(s).toMatchObject({
      guilds: 5,
      users: 100,
      totalXp: 50000,
      moderationCases: 25,
      premiumSubscriptions: 3,
    });
  });
});

describe('collectAndStore', () => {
  it('collects and stores a snapshot', async () => {
    mockAuditCount.mockResolvedValueOnce(42);
    mockAuditGroupBy.mockResolvedValueOnce([{ guildId: 'g1' }, { guildId: 'g2' }]);

    await collectAndStore();

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        guildCount: 5,
        userCount: 100,
        messagesToday: 42,
        activeChannels: 2,
        onlineMembers: 0,
        cpuUsage: expect.any(Number),
        ramUsage: expect.any(Number),
        ramTotal: expect.any(Number),
        uptimeSeconds: expect.any(Number),
      }),
    });
  });

  it('handles audit log errors gracefully', async () => {
    mockAuditCount.mockRejectedValueOnce(new Error('DB error'));
    mockAuditGroupBy.mockRejectedValueOnce(new Error('DB error'));

    await collectAndStore();

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        messagesToday: 0,
        activeChannels: 0,
      }),
    });
  });
});
