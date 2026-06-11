import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@pinguin/db';
import { webLogger } from '@/lib/logger';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { id: guildId, itemId } = await params;
    const body = await request.json();

    const settings = await prisma.economySettings.findUnique({ where: { guildId } });
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Économie non configurée' },
        { status: 404 },
      );
    }

    const existing = await prisma.shopItem.findFirst({
      where: { id: itemId, economySettingsId: settings.id },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Article introuvable' },
        { status: 404 },
      );
    }

    const validTypes = ['ROLE', 'XP_BOOST', 'ANTI_THEFT', 'LOTTO_TICKET'];
    const updateData: Record<string, unknown> = {};

    if (body.name?.trim()) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.price !== undefined && body.price >= 1) updateData.price = body.price;
    if (body.type && validTypes.includes(body.type)) updateData.type = body.type;
    if (body.roleId !== undefined) updateData.roleId = body.roleId || null;
    if (body.duration !== undefined) updateData.duration = body.duration ?? null;
    if (body.effectValue !== undefined) updateData.effectValue = body.effectValue ?? null;

    const item = await prisma.shopItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: { item } });
  } catch (error) {
    webLogger.error('Error updating shop item:', error as Record<string, unknown>);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { id: guildId, itemId } = await params;

    const settings = await prisma.economySettings.findUnique({ where: { guildId } });
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Économie non configurée' },
        { status: 404 },
      );
    }

    const existing = await prisma.shopItem.findFirst({
      where: { id: itemId, economySettingsId: settings.id },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Article introuvable' },
        { status: 404 },
      );
    }

    await prisma.shopItem.delete({ where: { id: itemId } });

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    webLogger.error('Error deleting shop item:', error as Record<string, unknown>);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la suppression' },
      { status: 500 },
    );
  }
}
