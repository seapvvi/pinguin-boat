import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@pinguin/db';
import { webLogger } from '@/lib/logger';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; notifId: string }> },
) {
  try {
    const { id: guildId, notifId: id } = await params;

    const existing = await prisma.streamNotification.findUnique({ where: { id } });
    if (!existing || existing.guildId !== guildId) {
      return NextResponse.json(
        { success: false, error: 'Notification introuvable' },
        { status: 404 },
      );
    }

    const body = await request.json();

    const notification = await prisma.streamNotification.update({
      where: { id },
      data: {
        ...(body.discordChannelId !== undefined && { discordChannelId: body.discordChannelId }),
        ...(body.channelId !== undefined && { channelId: body.channelId || null }),
        ...(body.customTitle !== undefined && { customTitle: body.customTitle || null }),
        ...(body.customDescription !== undefined && { customDescription: body.customDescription || null }),
        ...(body.customColor !== undefined && { customColor: body.customColor || null }),
        ...(body.customFooter !== undefined && { customFooter: body.customFooter || null }),
        ...(body.mentionRoleId !== undefined && { mentionRoleId: body.mentionRoleId || null }),
        ...(body.pingEveryoneOnLive !== undefined && { pingEveryoneOnLive: body.pingEveryoneOnLive }),
      },
    });

    return NextResponse.json({ success: true, data: { notification } });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour de la notification' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; notifId: string }> },
) {
  try {
    const { id: guildId, notifId: id } = await params;

    const existing = await prisma.streamNotification.findUnique({ where: { id } });
    if (!existing || existing.guildId !== guildId) {
      return NextResponse.json(
        { success: false, error: 'Notification introuvable' },
        { status: 404 },
      );
    }

    await prisma.streamNotification.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { success: true } });
  } catch (error) {
    webLogger.error('Error deleting notification:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la suppression de la notification' },
      { status: 500 },
    );
  }
}
