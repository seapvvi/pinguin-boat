import { NextResponse } from 'next/server';
import { isSetupRequired, getSetupPassword } from '@/lib/setup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ setupRequired: isSetupRequired() });
}

/** Vérifie le mot de passe de setup (étape 1 du formulaire). */
export async function POST(req: Request) {
  if (!isSetupRequired()) {
    return NextResponse.json({ ok: false, error: 'Configuration déjà terminée.' }, { status: 403 });
  }

  const expected = getSetupPassword();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'SETUP_PASSWORD est absent du .env racine. Ajoutez-le puis redémarrez.' },
      { status: 500 }
    );
  }

  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'Requête invalide.' }, { status: 400 });
  }

  if (body.password !== expected) {
    return NextResponse.json({ ok: false, error: 'Mot de passe incorrect.' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
