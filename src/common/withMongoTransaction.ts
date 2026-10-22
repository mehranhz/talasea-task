import mongoose, { type ClientSession } from 'mongoose';
import { ServiceUnavailableError } from './errors/errors';

const MAX_TIME_MS = 15_000;

function isRetryableTransactionError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const candidate = err as { code?: unknown; codeName?: unknown; errorLabels?: unknown; name?: unknown };
  if (candidate.code === 112 || candidate.codeName === 'WriteConflict') return true;
  if (candidate.code === 50 || candidate.codeName === 'MaxTimeMSExpired') return true;
  if (candidate.name === 'MongoOperationTimeoutError' || candidate.name === 'MongoServerSelectionError') return true;
  if (!Array.isArray(candidate.errorLabels)) return false;
  return (
    candidate.errorLabels.includes('TransientTransactionError') ||
    candidate.errorLabels.includes('UnknownTransactionCommitResult')
  );
}

export async function withMongoTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(fn, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      timeoutMS: MAX_TIME_MS,
    });
  } catch (err) {
    if (isRetryableTransactionError(err)) {
      throw new ServiceUnavailableError('Transaction could not be committed in time');
    }
    throw err;
  } finally {
    await session.endSession();
  }
}
