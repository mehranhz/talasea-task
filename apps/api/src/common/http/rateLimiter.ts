import type { NextFunction, Request, Response } from 'express';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { RateLimitedError } from '../errors/errors';

const INCREMENT_WINDOW = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return current
`;

export class RateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly windowMs: number,
    private readonly max: number,
  ) {}

  limit(options: { byWallet: boolean } = { byWallet: false }) {
    return (req: Request, res: Response, next: NextFunction): void => {
      void this.enforce(req, options.byWallet)
        .then(() => next())
        .catch(next);
    };
  }

  private async enforce(req: Request, byWallet: boolean): Promise<void> {
    const bucket = Math.floor(Date.now() / this.windowMs);
    const ip = req.ip && req.ip.length > 0 ? req.ip : 'unknown';
    await this.hit(`rl:ip:${ip}:${bucket}`);
    if (!byWallet) return;
    const walletId = walletKey(req);
    if (walletId) {
      await this.hit(`rl:wallet:${walletId}:${bucket}`);
    }
  }

  private async hit(key: string): Promise<void> {
    try {
      const count = await this.redis.eval(INCREMENT_WINDOW, 1, key, String(this.windowMs));
      if (Number(count) > this.max) {
        throw new RateLimitedError();
      }
    } catch (err) {
      if (err instanceof RateLimitedError) throw err;
      this.logger.warn({ err, key }, 'rate limiter fail open');
    }
  }
}

function walletKey(req: Request): string | undefined {
  const fromParams = req.params.walletId;
  if (typeof fromParams === 'string' && fromParams.length > 0) return fromParams;
  if (typeof req.body !== 'object' || req.body === null) return undefined;
  const body = req.body as { fromWalletId?: unknown };
  return typeof body.fromWalletId === 'string' && body.fromWalletId.length > 0
    ? body.fromWalletId
    : undefined;
}
