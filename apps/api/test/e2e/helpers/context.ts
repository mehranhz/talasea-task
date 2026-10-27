import type { Server } from 'node:http';
import mongoose from 'mongoose';
import { App } from '../../../src/core/App';
import { ensureInfra, mongoUri } from './infra';

let infraReady = false;

export interface E2EContext {
  baseUrl: string;
  dbName: string;
  teardown: () => Promise<void>;
}

/** Starts one API on a fresh database. Teardown drops it so one suite's balances cannot leak into the next. */
export async function createE2EContext(
  suffix: string,
  options: { redisUrl?: string } = {},
): Promise<E2EContext> {
  if (!infraReady) {
    await ensureInfra();
    infraReady = true;
  }

  const dbName = `wallet_e2e_${suffix}_${Date.now().toString(36)}`;
  const port = 30_000 + Math.floor(Math.random() * 10_000);

  process.env.MONGO_URI = mongoUri(dbName);
  process.env.REDIS_URL = options.redisUrl ?? 'redis://127.0.0.1:6379';
  process.env.PORT = String(port);
  process.env.LOG_LEVEL = 'error';
  process.env.RATE_LIMIT_MAX = '1000000';
  process.env.RATE_LIMIT_WINDOW_MS = '60000';
  process.env.BALANCE_CACHE_TTL_SECONDS = '30';
  process.env.LEDGER_ARCHIVE_AFTER_DAYS = '90';

  const app = await App.create('api');
  const server = await app.listen();
  const baseUrl = serverAddress(server, port);

  return {
    baseUrl,
    dbName,
    teardown: async () => {
      await app.closeHttp();
      const db = mongoose.connection.db;
      if (db) await db.dropDatabase();
      await app.shutdown();
    },
  };
}

function serverAddress(server: Server, fallbackPort: number): string {
  const addr = server.address();
  if (typeof addr === 'object' && addr) return `http://127.0.0.1:${addr.port}`;
  return `http://127.0.0.1:${fallbackPort}`;
}
