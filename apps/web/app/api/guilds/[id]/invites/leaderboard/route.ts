import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@pinguin/db';
import { webLogger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: guildId } = await params;

    const leaderboard = await prisma.$queryRaw<Array<{
      inviter_id: string;
      total_invites: bigint;
      fake_invites: bigint;
      left_invites: bigint;
      net_invites: bigint;
    }>>`
      SELECT
        inviter_id,
        COUNT(*) as total_invites,
        SUM(CASE WHEN is_fake = true THEN 1 ELSE 0 END) as fake_invites,
        SUM(CASE WHEN has_left = true THEN 1 ELSE 0 END) as left_invites,
        COUNT(*) - SUM(CASE WHEN is_fake = true THEN 1 ELSE 0 END) - SUM(CASE WHEN has_left = true THEN 1 ELSE 0 END) as net_invites
      FROM invite_tracks
      WHERE guild_id = ${guildId}
      GROUP BY inviter_id
      ORDER BY net_invites DESC
      LIMIT 50
    `;

    const users = await prisma.user.findMany({
      where: { discordId: { in: leaderboard.map(e => e.inviter_id) } },
      select: { discordId: true, username: true, avatar: true },
    });

    const userMap = new Map(users.map(u => [u.discordId, u]));

    const entries = leaderboard.map((entry) => {
      const user = userMap.get(entry.inviter_id);

      return {
        rank: 0, // Will be set after sorting
        userId: entry.inviter_id,
        username: user?.username ?? 'Inconnu',
        avatar: user?.avatar,
        totalInvites: Number(entry.total_invites),
        fakeInvites: Number(entry.fake_invites),
        leftInvites: Number(entry.left_invites),
        netInvites: Number(entry.net_invites),
      };
    });

    const rankedEntries = entries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    return NextResponse.json({
      success: true,
      data: { leaderboard: rankedEntries },
    });
  } catch (error) {
    webLogger.error('Error fetching invite leaderboard:', error as Record<string, unknown>);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la récupération du classement',
      },
      { status: 500 }
    );
  }
}
