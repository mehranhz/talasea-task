import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  MONGO_URI: z.string().min(1),
  MONGO_MAX_POOL_SIZE: z.coerce.number().int().positive().default(50),
  MONGO_MIN_POOL_SIZE: z.coerce.number().int().min(0).default(5),
  MONGO_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  MONGO_SOCKET_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  REDIS_URL: z.string().min(1),
  BALANCE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10_000),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  RECONCILIATION_CRON: z.string().min(1).default('0 * * * *'),
  LEDGER_ARCHIVE_CRON: z.string().min(1).default('15 3 * * *'),
  LEDGER_ARCHIVE_AFTER_DAYS: z.coerce.number().int().positive().default(90),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SUPPORTED_ASSETS: z
    .string()
    .min(1)
    .default('USD')
    .transform((value) =>
      value
        .split(',')
        .map((asset) => asset.trim())
        .filter((asset) => asset.length > 0),
    ),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3001,http://127.0.0.1:3001')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
});

export type Env = z.infer<typeof envSchema>;

/** A blank variable is treated as unset so the schema default applies. */
/** Blank env values are missing, so Zod can apply the default instead of treating "" as a real setting. */
/** Blank env values are missing, so Zod defaults apply instead of an empty string. */
function read(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') return undefined;
  return value;
}

/** Fails at startup when a money-path setting is missing or not a number. The process does not serve traffic with an unbounded pool or an empty asset list. */
/** Fails at startup when a required setting is absent. Pool size, crons, and the archive window all come from here. */
export function loadEnv(): Env {
  const parsed = envSchema.safeParse({
    PORT: read('PORT'),
    MONGO_URI: read('MONGO_URI'),
    MONGO_MAX_POOL_SIZE: read('MONGO_MAX_POOL_SIZE'),
    MONGO_MIN_POOL_SIZE: read('MONGO_MIN_POOL_SIZE'),
    MONGO_SERVER_SELECTION_TIMEOUT_MS: read('MONGO_SERVER_SELECTION_TIMEOUT_MS'),
    MONGO_SOCKET_TIMEOUT_MS: read('MONGO_SOCKET_TIMEOUT_MS'),
    REDIS_URL: read('REDIS_URL'),
    BALANCE_CACHE_TTL_SECONDS: read('BALANCE_CACHE_TTL_SECONDS'),
    RATE_LIMIT_WINDOW_MS: read('RATE_LIMIT_WINDOW_MS'),
    RATE_LIMIT_MAX: read('RATE_LIMIT_MAX'),
    WORKER_CONCURRENCY: read('WORKER_CONCURRENCY'),
    RECONCILIATION_CRON: read('RECONCILIATION_CRON'),
    LEDGER_ARCHIVE_CRON: read('LEDGER_ARCHIVE_CRON'),
    LEDGER_ARCHIVE_AFTER_DAYS: read('LEDGER_ARCHIVE_AFTER_DAYS'),
    LOG_LEVEL: read('LOG_LEVEL'),
    SUPPORTED_ASSETS: read('SUPPORTED_ASSETS'),
    TRUST_PROXY: read('TRUST_PROXY'),
    CORS_ORIGINS: read('CORS_ORIGINS'),
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${message}`);
  }

  if (parsed.data.SUPPORTED_ASSETS.length === 0) {
    throw new Error('Invalid environment: SUPPORTED_ASSETS must list at least one asset');
  }

  return parsed.data;
}
