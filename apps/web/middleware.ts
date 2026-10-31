import { NextResponse, type NextRequest } from 'next/server';

/**
 * Redirige tout le site vers /setup tant que la configuration initiale
 * (.env racine) est incomplète. Le statut est demandé à la route API
 * interne (le middleware edge ne peut pas lire le disque).
 */

const ALLOWED_PREFIXES = ['/setup', '/api/setup', '/_next', '/favicon', '/logo.svg'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  try {
    const res = await fetch(new URL('/api/setup/status', req.url), {
      headers: { 'x-setup-check': '1' },
      cache: 'no-store',
    });
    const data = (await res.json()) as { setupRequired?: boolean };
    if (data.setupRequired) {
      const url = req.nextUrl.clone();
      url.pathname = '/setup';
      url.search = '';
      return NextResponse.redirect(url);
    }
  } catch {
    // Serveur pas encore prêt : on laisse passer.
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.svg).*)'],
};
