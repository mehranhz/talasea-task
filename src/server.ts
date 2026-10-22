import { App } from './core/App';
import { loadEnv } from './config/env';
import { createLogger } from './config/logger';

const FORCE_EXIT_MS = 10_000;

async function main(): Promise<void> {
  const app = await App.create('api');
  const logger = createLogger(loadEnv());
  await app.listen();

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutdown requested');
    const timer = setTimeout(() => {
      logger.error('shutdown timed out');
      process.exit(1);
    }, FORCE_EXIT_MS);
    timer.unref();
    void (async () => {
      try {
        await app.closeHttp();
        await app.shutdown();
        clearTimeout(timer);
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'shutdown failed');
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
