import type { Router } from 'express';
import type { Container } from './Container';

export abstract class Module {
  abstract providers(c: Container): void;

  routes(_c: Container): { path: string; router: Router } | null {
    return null;
  }

  async onInit(_c: Container): Promise<void> {}

  async onShutdown(_c: Container): Promise<void> {}
}
