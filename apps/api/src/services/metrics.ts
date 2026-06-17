import { prisma } from '@pinguin/db';
import * as os from 'os';

interface SystemMetricsData {
  cpu: number;
  ram: { used: number; total: number; percent: number };
  uptime: number;
  processUptime: number;
  platform: string;
  nodeVersion: string;
  loadAvg: number[];
}

let lastCpuMeasure: { idle: number; total: number } | null = null;

function sampleCPU(): { idle: number; total: number } {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) totalTick += (cpu.times as any)[type];
    totalIdle += cpu.times.idle;
  }
  return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}

function getCPUUsage(): number {
  const current = sampleCPU();
  if (!lastCpuMeasure) {
    lastCpuMeasure = current;
    return 0;
  }
  const idleDiff = current.idle - lastCpuMeasure.idle;
  const totalDiff = current.total - lastCpuMeasure.total;
  lastCpuMeasure = current;
  if (totalDiff === 0) return 0;
  return parseFloat(((1 - idleDiff / totalDiff) * 100).toFixed(2));
}

export function getSystemMetrics(): SystemMetricsData {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    cpu: getCPUUsage(),
    ram: {
      used: Math.round(usedMem / 1024 / 1024),
      total: Math.round(totalMem / 1024 / 1024),
      percent: parseFloat(((usedMem / totalMem) * 100).toFixed(2)),
    },
    uptime: os.uptime(),
    processUptime: process.uptime(),
    platform: os.platform(),
    nodeVersion: process.version,
    loadAvg: os.loadavg(),
  };
}

export async function collectAndStore(): Promise<void> {
  const metrics = getSystemMetrics();

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [guildCount, userCount, messagesToday, activeGuilds] = await Promise.all([
    prisma.guild.count(),
    prisma.user.count(),
    prisma.auditLog.count({
      where: { createdAt: { gte: last24h } },
    }).catch(() => 0),
    prisma.auditLog.groupBy({
      by: ['guildId'],
      where: { createdAt: { gte: last24h }, guildId: { not: null } },
    }).then((r) => r.length).catch(() => 0),
  ]);

  await prisma.systemMetricsSnapshot.create({
    data: {
      cpuUsage: metrics.cpu,
      ramUsage: metrics.ram.used,
      ramTotal: metrics.ram.total,
      uptimeSeconds: Math.floor(metrics.uptime),
      guildCount,
      userCount,
      commandCount: messagesToday,
      messagesToday,
      activeChannels: activeGuilds,
      onlineMembers: 0,
      timestamp: new Date(),
    },
  });
}

export async function getMetricsHistory(
  hours: number = 24
): Promise<any[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return prisma.systemMetricsSnapshot.findMany({
    where: { timestamp: { gte: since } },
    orderBy: { timestamp: 'asc' },
    take: 500,
  });
}

export async function getGlobalStats() {
  const [guildCount, userCount, totalXp, totalCases, premiumCount] =
    await Promise.all([
      prisma.guild.count(),
      prisma.user.count(),
      prisma.xPProfile.aggregate({ _sum: { xp: true } }),
      prisma.moderationCase.count(),
      prisma.premiumSubscription.count({
        where: { status: 'ACTIVE' },
      }),
    ]);

  return {
    guilds: guildCount,
    users: userCount,
    totalXp: totalXp._sum.xp || 0,
    moderationCases: totalCases,
    premiumSubscriptions: premiumCount,
  };
}
