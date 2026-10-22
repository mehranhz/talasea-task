import { AsyncLocalStorage } from 'node:async_hooks';
import pino, { type Logger } from 'pino';
import type { Env } from './env';

export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

export function createLogger(env: Env): Logger {
  return pino({
    level: env.LOG_LEVEL,
    mixin() {
      const store = requestContext.getStore();
      return store ? { requestId: store.requestId } : {};
    },
  });
}
