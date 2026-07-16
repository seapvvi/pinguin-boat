import http from 'http';
import { Client } from 'discord.js';
import { getStats } from '../services/stats';
import { logger } from '@pinguin/shared';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 30;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export function startPublicApi(client: Client, port: number): void {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const timestamp = new Date().toISOString();

    logger.info(`[PUBLIC API] ${req.method} ${req.url} — ${ip}`, { timestamp });

    if (isRateLimited(ip)) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 429;
      res.end(JSON.stringify({ error: 'Trop de requêtes. Réessayez dans une minute.' }));
      return;
    }

    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const path = url.pathname;

      if (path === '/stats' && req.method === 'GET') {
        const stats = await getStats(client);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(stats));
        return;
      }

      if (path === '/health' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err: unknown) {
      logger.error('[PUBLIC API] Erreur interne', { err });
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Erreur interne du serveur' }));
    }
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Le port ${port} est déjà utilisé — API publique non démarrée`);
    } else {
      logger.error('Erreur API publique', { err: err.message });
    }
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info(`API publique démarrée sur 0.0.0.0:${port}`);
  });
}
