import mongoose from 'mongoose';
import type { Env } from './env';

/** Opens the pool. Indexes are created in ensureIndexes, so autoIndex stays off. A localhost URI sets directConnection so the driver stays on the published port instead of following the replica set's advertised mongo hostname. The pool caps are the bound on concurrent money work. */
/** Opens a bounded pool. A localhost URI stays on that socket so the driver does not follow the replica-set name `mongo`. */
/** Opens the pool. A localhost URI stays on that socket so the driver does not follow the advertised `mongo` host. */
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

/** Host scripts use 127.0.0.1. Inside Compose the hostname is mongo, and replica-set discovery stays on. */
/** True for 127.0.0.1, localhost, and ::1. Inside Compose the host is `mongo`, so discovery stays on. */
/** Host scripts use 127.0.0.1. Inside Compose the hostname is `mongo`, so discovery stays on. */
function directForLocalHost(uri: string): boolean {
  try {
    const host = new URL(uri).hostname;
    return host === '127.0.0.1' || host === 'localhost' || host === '::1';
  } catch {
    return false;
  }
}

/** Closes the pool on process shutdown so in-flight transactions can end. */
/** Closes the pool on shutdown so a restart does not leave sockets in the previous process. */
/** Closes the pool on shutdown so the process does not leave sockets in the replica set. */
export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

/** Readiness probe. A closed or unselected connection is down, not a thrown error. */
export async function pingMongo(): Promise<boolean> {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return false;
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}
