import type { Container } from '../../core/Container';
import { Module } from '../../core/Module';
import { LOGGER, REDIS } from '../../core/tokens';
import { HealthController } from './health.controller';
import { buildHealthRouter } from './health.routes';

export class HealthModule extends Module {
  override providers(c: Container): void {
    c.register(HealthController, (container) => new HealthController(container.resolve(REDIS), container.resolve(LOGGER)));
  }

  override routes(c: Container): { path: string; router: ReturnType<typeof buildHealthRouter> } {
    return { path: '/health', router: buildHealthRouter(c.resolve(HealthController)) };
  }
}
