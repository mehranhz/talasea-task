import { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { Env } from './env';

export function createAppRedis(env: Env, logger: Logger): Redis {
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 1_000,
  });
  redis.on('error', (err: Error) => {
    logger.warn({ err: err.message }, 'redis error');
  });
  return redis;
}

export function createBullRedis(env: Env, logger: Logger): Redis {
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  redis.on('error', (err: Error) => {
    logger.warn({ err: err.message }, 'bullmq redis error');
  });
  return redis;
}
