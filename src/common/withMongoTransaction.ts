import mongoose, { type ClientSession } from 'mongoose';
import { ServiceUnavailableError } from './errors/errors';

const MAX_TIME_MS = 15_000;

/** Write conflicts and unknown commit results are contention, not a lost debit. The caller can retry with the same referenceId. */
/** Conflicts and commit uncertainty are transient. The caller sees 503 so the client can retry the same referenceId. */
/** Write conflicts and commit timeouts are transient. The caller answers 503 instead of reporting a partial debit. */
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

/** Snapshot plus majority makes a transfer's debit and credit one durable decision. A retryable failure becomes 503 so the client retries instead of seeing a false success. */
/**
 * One snapshot transaction for a money change. Majority write concern means the balance, ledger rows,
 * and outbox row commit together or not at all.
 */
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
