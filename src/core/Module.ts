import type { Router } from 'express';
import type { Container } from './Container';

export abstract class Module {
  /** Registers this module's services before any onInit, so a later module can resolve them. */
  abstract providers(c: Container): void;

  /** Mounts HTTP routes when the module has them. Returning null keeps non-HTTP modules off Express. */
  routes(_c: Container): { path: string; router: Router } | null {
    return null;
  }

  /** Runs after every provider is registered. The worker starts BullMQ consumers from its override of this hook. */
  async onInit(_c: Container): Promise<void> {}

  /** Runs during graceful shutdown, in reverse registration order, so a module can release its own resources first. */
  async onShutdown(_c: Container): Promise<void> {}
}
