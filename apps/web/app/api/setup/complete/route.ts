import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import {
  isSetupRequired,
  getSetupPassword,
  writeEnvFiles,
  type SetupValues,
} from '@/lib/setup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isSnowflake(v: string): boolean {
  return /^\d{17,20}$/.test(v);
}

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!isSetupRequired()) {
    return NextResponse.json({ ok: false, error: 'Configuration déjà terminée.' }, { status: 403 });
  }

  const expected = getSetupPassword();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'SETUP_PASSWORD est absent du .env racine.' },
      { status: 500 }
    );
  }

  let body: Partial<SetupValues> & { password?: string };
  try {
    body = (await req.json()) as Partial<SetupValues> & { password?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'Requête invalide.' }, { status: 400 });
  }

  if (body.password !== expected) {
    return NextResponse.json({ ok: false, error: 'Mot de passe incorrect.' }, { status: 401 });
  }

  const v: SetupValues = {
    clientId: (body.clientId ?? '').trim(),
    clientSecret: (body.clientSecret ?? '').trim(),
    token: (body.token ?? '').trim(),
    ownerId: (body.ownerId ?? '').trim(),
    publicKey: (body.publicKey ?? '').trim(),
    devGuildId: (body.devGuildId ?? '').trim(),
    databaseUrl: (body.databaseUrl ?? '').trim(),
    ownerPassword: body.ownerPassword ?? '',
    sessionSecret: (body.sessionSecret ?? '').trim() || crypto.randomBytes(32).toString('hex'),
    botInternalSecret: (body.botInternalSecret ?? '').trim() || crypto.randomBytes(32).toString('hex'),
    appUrl: (body.appUrl ?? '').trim().replace(/\/+$/, ''),
    apiUrl: (body.apiUrl ?? '').trim().replace(/\/+$/, ''),
  };

  const errors: string[] = [];
  if (!isSnowflake(v.clientId)) errors.push('DISCORD_CLIENT_ID invalide (18-20 chiffres).');
  if (!v.clientSecret) errors.push('DISCORD_CLIENT_SECRET requis.');
  if (!v.token) errors.push('DISCORD_TOKEN requis.');
  if (!isSnowflake(v.ownerId)) errors.push('DISCORD_OWNER_ID invalide (18-20 chiffres).');
  if (!/^[a-f0-9]{64}$/i.test(v.publicKey)) errors.push('DISCORD_PUBLIC_KEY invalide (64 caractères hex).');
  if (v.devGuildId && !isSnowflake(v.devGuildId)) errors.push('DISCORD_DEV_GUILD_ID invalide.');
  if (!/^postgres(ql)?:\/\//.test(v.databaseUrl)) errors.push('DATABASE_URL doit commencer par postgresql://');
  if (v.ownerPassword.length < 12) errors.push('OWNER_PASSWORD : 12 caractères minimum.');
  if (!isHttpUrl(v.appUrl)) errors.push('URL du site invalide.');
  if (!isHttpUrl(v.apiUrl)) errors.push('URL de l\'API invalide.');

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: errors.join(' ') }, { status: 400 });
  }

  try {
    writeEnvFiles(v);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: `Écriture impossible : ${msg}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, restartRequired: true });
}
