import { NextResponse } from 'next/server';
import net from 'node:net';
import { isSetupRequired } from '@/lib/setup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Teste la joignabilité TCP (hôte/port) d'une URL PostgreSQL.
 * Ne valide pas les identifiants — `pnpm db:push` s'en chargera.
 */
export async function POST(req: Request) {
  if (!isSetupRequired()) {
    return NextResponse.json({ ok: false, error: 'Configuration déjà terminée.' }, { status: 403 });
  }

  let body: { databaseUrl?: string };
  try {
    body = (await req.json()) as { databaseUrl?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'Requête invalide.' }, { status: 400 });
  }

  const raw = body.databaseUrl ?? '';
  let host: string;
  let port: number;
  try {
    const url = new URL(raw);
    if (!url.protocol.startsWith('postgres')) throw new Error();
    host = url.hostname;
    port = Number(url.port || 5432);
  } catch {
    return NextResponse.json({ ok: false, error: 'URL PostgreSQL invalide.' }, { status: 400 });
  }

  const reachable = await new Promise<boolean>((resolve) => {
    const socket = net.connect({ host, port, timeout: 3000 });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });

  if (!reachable) {
    return NextResponse.json({ ok: false, error: `Impossible de joindre ${host}:${port}.` });
  }
  return NextResponse.json({ ok: true });
}
