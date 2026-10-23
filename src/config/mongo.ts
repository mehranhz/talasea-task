import mongoose from 'mongoose';
import type { Env } from './env';

export async function connectMongo(env: Env): Promise<void> {
  mongoose.set('autoIndex', false);
  const directConnection = directForLocalHost(env.MONGO_URI);
  await mongoose.connect(env.MONGO_URI, {
    maxPoolSize: env.MONGO_MAX_POOL_SIZE,
    minPoolSize: env.MONGO_MIN_POOL_SIZE,
    serverSelectionTimeoutMS: env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
    socketTimeoutMS: env.MONGO_SOCKET_TIMEOUT_MS,
    ...(directConnection ? { directConnection: true } : {}),
  });
}

function directForLocalHost(uri: string): boolean {
  try {
    const host = new URL(uri).hostname;
    return host === '127.0.0.1' || host === 'localhost' || host === '::1';
  } catch {
    return false;
  }
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

export async function pingMongo(): Promise<boolean> {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return false;
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}
