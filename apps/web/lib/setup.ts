import fs from 'node:fs';
import path from 'node:path';

/**
 * Utilitaires de l'assistant de premier démarrage (/setup).
 * Le .env racine est lu directement sur disque (Next ne le charge pas nativement).
 * En dev, process.cwd() = apps/web → la racine du repo est deux niveaux au-dessus.
 */

const WEB_ROOT = process.cwd();
export const ROOT_ENV_PATH = path.resolve(WEB_ROOT, '../../.env');
export const WEB_ENV_PATH = path.join(WEB_ROOT, '.env.local');

const REQUIRED_KEYS = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_TOKEN',
  'DISCORD_OWNER_ID',
  'DISCORD_PUBLIC_KEY',
  'DATABASE_URL',
  'SESSION_SECRET',
  'BOT_INTERNAL_SECRET',
  'OWNER_PASSWORD',
  'API_URL',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_DISCORD_CLIENT_ID',
  'NEXT_PUBLIC_SITE_URL',
] as const;

export function parseEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

export function readRootEnv(): Record<string, string> {
  try {
    if (!fs.existsSync(ROOT_ENV_PATH)) return {};
    return parseEnv(fs.readFileSync(ROOT_ENV_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export function isSetupRequired(): boolean {
  const env = readRootEnv();
  return REQUIRED_KEYS.some((key) => !env[key]);
}

/** Mot de passe du /setup, lu depuis le .env racine (jamais commité). */
export function getSetupPassword(): string {
  return readRootEnv().SETUP_PASSWORD ?? '';
}

/** Échappe une valeur pour un fichier .env (guillemets si #, espaces, quotes). */
export function q(value: string): string {
  if (/[\s#"'\\]/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

export interface SetupValues {
  clientId: string;
  clientSecret: string;
  token: string;
  ownerId: string;
  publicKey: string;
  devGuildId: string;
  databaseUrl: string;
  ownerPassword: string;
  sessionSecret: string;
  botInternalSecret: string;
  appUrl: string;
  apiUrl: string;
}

export function buildRootEnv(v: SetupValues, existing: Record<string, string>): string {
  return `# ─────────────────────────────────────────────
# Pinguin BOAT — Configuration générée par l'assistant /setup
# ${new Date().toISOString()}
# ─────────────────────────────────────────────

# ── Discord ──
DISCORD_CLIENT_ID=${q(v.clientId)}
DISCORD_CLIENT_SECRET=${q(v.clientSecret)}
DISCORD_TOKEN=${q(v.token)}
DISCORD_OWNER_ID=${q(v.ownerId)}
DISCORD_PUBLIC_KEY=${q(v.publicKey)}
DISCORD_SUPPORT_INVITE=https://discord.gg/EJHhcYkXMQ
DISCORD_DEV_GUILD_ID=${q(v.devGuildId)}

# ── Base de données ──
DATABASE_URL=${q(v.databaseUrl)}

# ── Session ──
SESSION_SECRET=${q(v.sessionSecret)}
SESSION_MAX_AGE=604800

# ── API ──
API_HOST=0.0.0.0
API_PORT=4000
API_URL=${q(v.apiUrl)}
CORS_ORIGIN=${q(v.appUrl)}
API_INTERNAL_PORT=3004
NODE_ENV=development

# ── Web (Next.js) ──
NEXT_PUBLIC_API_URL=${q(v.apiUrl)}
NEXT_PUBLIC_APP_URL=${q(v.appUrl)}
NEXT_PUBLIC_DISCORD_CLIENT_ID=${q(v.clientId)}
NEXT_PUBLIC_SITE_URL=${q(v.appUrl)}

# ── Bot ──
BOT_ACTIVITY_TYPE=3
BOT_ACTIVITY_NAME=🏔️ Pinguin BOAT | /help
BOT_INTERNAL_URL=http://127.0.0.1:3003
BOT_INTERNAL_SECRET=${q(v.botInternalSecret)}

# ── Setup ──
SETUP_PASSWORD=${q(existing.SETUP_PASSWORD ?? '')}

# ── GitHub ──
GITHUB_REPO=seapvvi/pinguin-boat
GITHUB_BRANCH=master
GITHUB_TOKEN=

# ── Owner ──
OWNER_PASSWORD=${q(v.ownerPassword)}
OWNER_WEBHOOK_URL=

# ── Déploiement ──
DEPLOY_PATH=/opt/pinguinboat
DEPLOY_RELEASES_PATH=/opt/pinguinboat/releases
DEPLOY_SHARED_PATH=/opt/pinguinboat/shared
DEPLOY_BACKUPS_PATH=/opt/pinguinboat/backups
DEPLOY_CURRENT_LINK=/opt/pinguinboat/current

# ── Intégrations optionnelles ──
YOUTUBE_COOKIE=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SOUNDCLOUD_CLIENT_ID=
PASTEBIN_API_KEY=
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
YOUTUBE_API_KEY=

# ── Feature Flags ──
ALPHA_ALL_FREE=true
PREMIUM_ENABLED=false

# ── Logging ──
LOG_LEVEL=debug
LOG_FORMAT=pretty
`;
}

export function buildWebEnv(v: SetupValues): string {
  return `# Généré par l'assistant /setup — chargé nativement par Next.js
NEXT_PUBLIC_API_URL=${q(v.apiUrl)}
NEXT_PUBLIC_APP_URL=${q(v.appUrl)}
NEXT_PUBLIC_DISCORD_CLIENT_ID=${q(v.clientId)}
NEXT_PUBLIC_SITE_URL=${q(v.appUrl)}
`;
}

export function writeEnvFiles(v: SetupValues): void {
  const existing = readRootEnv();
  fs.writeFileSync(ROOT_ENV_PATH, buildRootEnv(v, existing), 'utf8');
  fs.writeFileSync(WEB_ENV_PATH, buildWebEnv(v), 'utf8');
}
