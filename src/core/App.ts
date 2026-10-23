import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { errorHandler } from '../common/http/errorHandler';
import { requestIdMiddleware } from '../common/http/requestId';
import { loadEnv } from '../config/env';
import { ensureIndexes } from '../config/indexes';
import { createLogger } from '../config/logger';
import { connectMongo, disconnectMongo } from '../config/mongo';
import { createAppRedis } from '../config/redis';
import { IdempotencyModule } from '../modules/idempotency/idempotency.module';
import { HealthModule } from '../modules/health/health.module';
import { QueueModule } from '../modules/queue/queue.module';
import { TransactionModule } from '../modules/transaction/transaction.module';
import { WalletModule } from '../modules/wallet/wallet.module';
import { Container } from './Container';
import { Module } from './Module';
import type { ProcessRole } from './role';
import { CONFIG, LOGGER, REDIS } from './tokens';

export class App {
  private server: Server | null = null;

  /** Private so boot always goes through create, with Mongo, Redis, and modules already up. */
  private constructor(
    readonly role: ProcessRole,
    private readonly container: Container,
    private readonly modules: Module[],
  ) {}

  /** Connects Mongo and Redis, registers every module, then runs onInit. BullMQ consumers start only when the role is worker. */
  static async create(role: ProcessRole): Promise<App> {
    const env = loadEnv();
    const logger = createLogger(env);
    const container = new Container();
    container.register(CONFIG, () => env);
    container.register(LOGGER, () => logger);

    await connectMongo(env);
    await ensureIndexes();
    const redis = createAppRedis(env, logger);
    container.register(REDIS, () => redis);

    const modules: Module[] = [
      new HealthModule(),
      new IdempotencyModule(),
      new TransactionModule(),
      new WalletModule(),
      new QueueModule(role),
    ];
    for (const mod of modules) {
      mod.providers(container);
    }
    for (const mod of modules) {
      await mod.onInit(container);
    }

    logger.info({ role }, 'application initialized');
    return new App(role, container, modules);
  }

  /** Assembles middleware and module routes in one place, so listen only has to bind the port. */
  express(): Express {
    const env = this.container.resolve(CONFIG);
    const app = express();
    app.disable('x-powered-by');
    if (env.TRUST_PROXY) {
      app.set('trust proxy', 1);
    }
    app.use(express.json({ limit: '10kb' }));
    app.use(requestIdMiddleware);

    for (const mod of this.modules) {
      const mounted = mod.routes(this.container);
      if (mounted) {
        app.use(mounted.path, mounted.router);
      }
    }

    app.use(errorHandler(this.container.resolve(LOGGER)));
    return app;
  }

  /** Opens the HTTP port for the API process. The worker process does not serve traffic. */
  async listen(): Promise<Server> {
    const env = this.container.resolve(CONFIG);
    const logger = this.container.resolve(LOGGER);
    const app = this.express();
    const server = await new Promise<Server>((resolve, reject) => {
      const listening = app.listen(env.PORT, () => resolve(listening));
      listening.on('error', reject);
    });
    this.server = server;
    logger.info({ port: env.PORT }, 'api listening');
    return server;
  }

  /** Drains the HTTP server during graceful shutdown, while Mongo and Redis are still connected. */
  async closeHttp(): Promise<void> {
    const server = this.server;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    this.server = null;
  }

  /** Shuts modules down in reverse registration order, then disconnects Redis and Mongo. Queue workers stop before those connections drop. */
  async shutdown(): Promise<void> {
    const logger = this.container.resolve(LOGGER);
    for (const mod of [...this.modules].reverse()) {
      await mod.onShutdown(this.container);
    }
    const redis = this.container.resolve(REDIS);
    try {
      await redis.quit();
    } catch (err) {
      logger.warn({ err }, 'redis quit failed');
      redis.disconnect();
    }
    await disconnectMongo();
    logger.info('shutdown complete');
  }
}
