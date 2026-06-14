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
  SESSION_SECRET: z.string().min(64),
  SESSION_MAX_AGE: z.coerce.number().default(604800),

  // API
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().default(4000),
  API_URL: z.string().url(),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

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

  // Owner
  OWNER_PASSWORD: z.string().min(8),

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
  return config;
}

export function getConfig(): EnvConfig {
  if (!config) {
    return loadConfig();
  }
  return config;
}

export { envSchema };
