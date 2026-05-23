import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Discord
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_OWNER_ID: z.string().min(1),
  DISCORD_PUBLIC_KEY: z.string().min(1),

  // Database
  DATABASE_URL: z.string().url(),

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
  NEXT_PUBLIC_DISCORD_CLIENT_ID: z.string().min(1),
  NEXT_PUBLIC_DISCORD_REDIRECT_URI: z.string().url(),
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

  // Feature Flags
  ALPHA_ALL_FREE: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('true'),
  PREMIUM_ENABLED: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('false'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['pretty', 'json']).default('pretty'),
});

export type EnvConfig = z.infer<typeof envSchema>;

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
