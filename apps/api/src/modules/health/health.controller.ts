import type { Request, Response } from 'express';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { pingMongo } from '../../config/mongo';

async function pingRedis(redis: Redis): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

export class HealthController {
  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  live = (req: Request, res: Response): void => {
    res.status(200).json({
      data: { status: 'ok' },
      meta: { requestId: req.requestId },
    });
  };

  ready = async (req: Request, res: Response): Promise<void> => {
    const [mongoUp, redisUp] = await Promise.all([pingMongo(), pingRedis(this.redis)]);
    if (!mongoUp || !redisUp) {
      this.logger.warn({ mongoUp, redisUp }, 'readiness check failed');
    }
    res.status(mongoUp && redisUp ? 200 : 503).json({
      data: {
        mongo: mongoUp ? 'up' : 'down',
        redis: redisUp ? 'up' : 'down',
      },
      meta: { requestId: req.requestId },
    });
  };
}
