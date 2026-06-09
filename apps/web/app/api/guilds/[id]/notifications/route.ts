import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@pinguin/db';
import { webLogger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: guildId } = await params;

    const notifications = await prisma.streamNotification.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: { notifications } });
  } catch (error) {
    webLogger.error('Error fetching notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement des notifications' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: guildId } = await params;
    const body = await request.json();

    if (!body.platform || !body.channelName || !body.discordChannelId) {
      return NextResponse.json(
        { success: false, error: 'Champs requis manquants' },
        { status: 400 },
      );
    }

    const notification = await prisma.streamNotification.create({
      data: {
        guildId,
        platform: body.platform,
        channelName: body.channelName,
        discordChannelId: body.discordChannelId,
        channelId: body.channelId || null,
      },
    });

    return NextResponse.json({ success: true, data: { notification } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Cette notification existe déjà pour ce serveur' },
        { status: 409 },
      );
    }
    webLogger.error('Error creating notification:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création de la notification' },
      { status: 500 },
    );
  }
}
