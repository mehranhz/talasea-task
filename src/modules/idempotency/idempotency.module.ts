import type { Container } from '../../core/Container';
import { Module } from '../../core/Module';
import { CONFIG, LOGGER, REDIS } from '../../core/tokens';
import { RateLimiter } from '../../common/http/rateLimiter';
import { IdempotencyService } from './idempotency.service';

export class IdempotencyModule extends Module {
  override providers(c: Container): void {
    c.register(
      IdempotencyService,
      (container) => new IdempotencyService(container.resolve(REDIS), container.resolve(LOGGER)),
    );
    c.register(RateLimiter, (container) => {
      const env = container.resolve(CONFIG);
      return new RateLimiter(
        container.resolve(REDIS),
        container.resolve(LOGGER),
        env.RATE_LIMIT_WINDOW_MS,
        env.RATE_LIMIT_MAX,
      );
    });
  }
}
