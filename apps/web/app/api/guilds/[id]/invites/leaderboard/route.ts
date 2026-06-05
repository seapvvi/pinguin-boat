import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@pinguin/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guildId = params.id;

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
        COUNT(*) - SUM(CASE WHEN has_left = true THEN 1 ELSE 0 END) as net_invites
      FROM invite_tracks
      WHERE guild_id = ${guildId}
      GROUP BY inviter_id
      ORDER BY net_invites DESC
      LIMIT 10
    `;

    const entries = await Promise.all(
      leaderboard.map(async (entry) => {
        const user = await prisma.user.findUnique({
          where: { discordId: entry.inviter_id },
          select: { username: true, avatar: true },
        });

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
      })
    );

    const rankedEntries = entries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    return NextResponse.json({
      success: true,
      data: { leaderboard: rankedEntries },
    });
  } catch (error) {
    console.error('Error fetching invite leaderboard:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la récupération du classement',
      },
      { status: 500 }
    );
  }
}
