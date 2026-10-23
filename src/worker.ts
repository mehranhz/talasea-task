import { App } from './core/App';
import { loadEnv } from './config/env';
import { createLogger } from './config/logger';

const FORCE_EXIT_MS = 10_000;

/** Boots the worker process. This is the only process that starts BullMQ consumers. */
async function main(): Promise<void> {
  const app = await App.create('worker');
  const logger = createLogger(loadEnv());
  logger.info('worker running');

  let shuttingDown = false;
  /** Stops queue workers, then Redis and Mongo, so in-flight jobs can finish. A second signal is ignored, and the timer exits if shutdown stalls. */
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'worker shutdown requested');
    const timer = setTimeout(() => {
      logger.error('worker shutdown timed out');
      process.exit(1);
    }, FORCE_EXIT_MS);
    timer.unref();
    void (async () => {
      try {
        await app.shutdown();
        clearTimeout(timer);
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'worker shutdown failed');
        process.exit(1);
      }
    })();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

void main().catch((err: unknown) => {
  process.stderr.write(`fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
