import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@pinguin/db';
import { webLogger } from '@/lib/logger';
import { ECONOMY_LIMITS } from '@/lib/economy-validation';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: guildId } = await params;
    const settings = await prisma.economySettings.findUnique({
      where: { guildId },
      include: { shopItems: { orderBy: { createdAt: 'asc' } } },
    });

    if (!settings) {
      return NextResponse.json({ success: true, data: { items: [] } });
    }

    return NextResponse.json({ success: true, data: { items: settings.shopItems } });
  } catch (error) {
    webLogger.error('Error fetching shop items:', error as Record<string, unknown>);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement des articles' },
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

    if (!body.name?.trim() || !body.price || body.price < 1) {
      return NextResponse.json(
        { success: false, error: 'Nom requis et prix ≥ 1' },
        { status: 400 },
      );
    }

    if (body.price > ECONOMY_LIMITS.weeklyAmount.max) {
      return NextResponse.json(
        { success: false, error: `Prix maximum: ${ECONOMY_LIMITS.weeklyAmount.max}` },
        { status: 400 },
      );
    }

    const validTypes = ['ROLE', 'XP_BOOST', 'ANTI_THEFT', 'LOTTO_TICKET'];
    if (body.type && !validTypes.includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Type invalide' },
        { status: 400 },
      );
    }

    if ((body.type || 'ROLE') === 'ROLE' && !body.roleId) {
      return NextResponse.json(
        { success: false, error: 'Rôle requis pour les items de type ROLE' },
        { status: 400 },
      );
    }

    let settings = await prisma.economySettings.findUnique({ where: { guildId } });

    if (!settings) {
      settings = await prisma.economySettings.create({
        data: { guildId },
      });
    }

    const item = await prisma.shopItem.create({
      data: {
        economySettingsId: settings.id,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        price: body.price,
        type: body.type || 'ROLE',
        roleId: body.type === 'ROLE' ? body.roleId : null,
        duration: body.duration ?? null,
        effectValue: body.effectValue ?? null,
      },
    });

    return NextResponse.json({ success: true, data: { item } }, { status: 201 });
  } catch (error) {
    webLogger.error('Error creating shop item:', error as Record<string, unknown>);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création de l\'article' },
      { status: 500 },
    );
  }
}
