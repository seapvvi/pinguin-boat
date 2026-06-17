import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (3 levels up from packages/config/src/)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Discord
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_OWNER_ID: z.string().min(1),
  DISCORD_PUBLIC_KEY: z.string().min(1),
  DISCORD_SUPPORT_INVITE: z.string().url().optional().default(''),

  // Database
  DATABASE_URL: z.string().trim().url(),

  // Session
  SESSION_SECRET: z.string().min(32),
  SESSION_MAX_AGE: z.coerce.number().default(604800),

  // API
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().default(4000),
  API_URL: z.string().url(),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  BOT_INTERNAL_PORT: z.coerce.number().default(4001),
  BOT_INTERNAL_SECRET: z.string().min(32),

  // Web
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_DISCORD_CLIENT_ID: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),

  // Bot
  BOT_ACTIVITY_TYPE: z.coerce.number().default(3),
  BOT_ACTIVITY_NAME: z.string().default('🏔️ Pinguin BOAT | /help'),

  // Music
  YOUTUBE_COOKIE: z.string().optional(),
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  SOUNDCLOUD_CLIENT_ID: z.string().optional(),

  // GitHub
  GITHUB_REPO: z.string().default(''),
  GITHUB_BRANCH: z.string().default('main'),
  GITHUB_TOKEN: z.string().optional(),

  // Deploy
  DEPLOY_PATH: z.string().default('/opt/pinguinboat'),
  DEPLOY_RELEASES_PATH: z.string().default('/opt/pinguinboat/releases'),
  DEPLOY_SHARED_PATH: z.string().default('/opt/pinguinboat/shared'),
  DEPLOY_BACKUPS_PATH: z.string().default('/opt/pinguinboat/backups'),
  DEPLOY_CURRENT_LINK: z.string().default('/opt/pinguinboat/current'),
  DEPLOY_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  DEPLOY_ALLOWED_BRANCHES: z.string().default('main'),
  // ^ Guard: branches autorisées pour le déploiement (séparées par virgule).
  //   Production typiquement "main" seulement. Staging peut autoriser "develop,main".
  //   Un déploiement depuis une branche non listée sera refusé.
  DEPLOY_TIMEOUT: z.coerce.number().default(600000),
  // ^ Guard: timeout total du déploiement en ms (défaut 10 min).
  DEPLOY_STEP_TIMEOUT: z.coerce.number().default(120000),
  // ^ Guard: timeout par étape en ms (défaut 2 min).

  // Owner
  OWNER_PASSWORD: z.string().trim().min(12, 'OWNER_PASSWORD est requis (min 12 caractères). Configurez-le dans votre fichier .env'),

  // Feature Flags
  ALPHA_ALL_FREE: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('true'),
  PREMIUM_ENABLED: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('false'),

  // Pastebin
  PASTEBIN_API_KEY: z.string().optional().default(''),

  // Twitch
  TWITCH_CLIENT_ID: z.string().optional().default(''),
  TWITCH_CLIENT_SECRET: z.string().optional().default(''),

  // YouTube
  YOUTUBE_API_KEY: z.string().optional().default(''),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['pretty', 'json']).default('pretty'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let _allowedRedirectUris: string[] | null = null;

export function getAllowedRedirectUris(): string[] {
  if (!_allowedRedirectUris) {
    const appUrl = getConfig().NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
    _allowedRedirectUris = [`${appUrl}/auth/callback`];
  }
  return _allowedRedirectUris;
}

function validateSecrets(env: EnvConfig): void {
  const isProd = env.NODE_ENV === 'production';

  const checks: { key: string; value: string; minLength: number; label: string; forbidden?: string[] }[] = [
    { key: 'SESSION_SECRET', value: env.SESSION_SECRET, minLength: 32, label: 'SESSION_SECRET' },
    { key: 'BOT_INTERNAL_SECRET', value: env.BOT_INTERNAL_SECRET, minLength: 32, label: 'BOT_INTERNAL_SECRET', forbidden: ['dev-secret', 'changeme_generate_a_random_32char_string'] },
    { key: 'OWNER_PASSWORD', value: env.OWNER_PASSWORD, minLength: 12, label: 'OWNER_PASSWORD' },
  ];

  for (const { value, minLength, label, forbidden } of checks) {
    if (value.length < minLength) {
      const msg = `${label} doit faire au moins ${minLength} caractères (actuellement ${value.length})`;
      if (isProd) throw new Error(msg);
      console.warn(`\x1b[33m⚠️  ${msg}\x1b[0m`);
      continue;
    }
    if (forbidden?.includes(value)) {
      const msg = `${label} est défini sur une valeur par défaut dangereuse (\u00AB ${value} \u00BB). Générez une chaîne aléatoire unique.`;
      if (isProd) throw new Error(msg);
      console.warn(`\x1b[33m⚠️  ${msg}\x1b[0m`);
    }
  }
}

let config: EnvConfig | null = null;

export function loadConfig(): EnvConfig {
  if (config) return config;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Configuration invalide :');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    throw new Error('Erreur de configuration. Vérifiez votre fichier .env');
  }

  config = result.data;
  validateSecrets(config);
  return config;
}

export function getConfig(): EnvConfig {
  if (!config) {
    return loadConfig();
  }
  return config;
}

export { envSchema };
