import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { ClientSession } from 'mongoose';
import type { Logger } from 'pino';
import { OperationModel } from './operation.model';
import type { NewOperation, OperationDoc, StoredResult } from './operation.types';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export interface FingerprintInput {
  type: string;
  asset: string;
  amount: string;
  walletIds: string[];
}

export interface IdempotencyRecord {
  fingerprint: string;
  result: StoredResult;
}

export class IdempotencyService {
  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  fingerprint(input: FingerprintInput): string {
    const walletIds = [...input.walletIds].sort();
    const canonical = `${input.type}|${input.asset}|${input.amount}|${walletIds.join(',')}`;
    return createHash('sha256').update(canonical).digest('hex');
  }

  async find(referenceId: string): Promise<IdempotencyRecord | null> {
    const cached = await this.readFast(referenceId);
    if (cached) return cached;
    const doc = await OperationModel.findOne({ referenceId }).lean<OperationDoc>().exec();
    if (!doc) return null;
    return { fingerprint: doc.fingerprint, result: doc.result };
  }

  async insert(input: NewOperation, session: ClientSession): Promise<void> {
    await OperationModel.create(
      [
        {
          referenceId: input.referenceId,
          type: input.type,
          fingerprint: input.fingerprint,
          status: 'COMPLETED',
          result: input.result,
          createdAt: new Date(),
        },
      ],
      { session },
    );
  }

  async remember(referenceId: string, fingerprint: string, result: StoredResult): Promise<void> {
    try {
      await this.redis.set(
        cacheKey(referenceId),
        JSON.stringify({ fingerprint, result }),
        'EX',
        IDEMPOTENCY_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn({ err, referenceId }, 'idempotency cache write failed');
    }
  }

  private async readFast(referenceId: string): Promise<IdempotencyRecord | null> {
    try {
      const raw = await this.redis.get(cacheKey(referenceId));
      if (raw === null) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const record = parsed as Partial<IdempotencyRecord>;
      if (typeof record.fingerprint !== 'string' || !record.result || typeof record.result !== 'object') {
        return null;
      }
      if (typeof record.result.statusCode !== 'number' || typeof record.result.data !== 'object' || record.result.data === null) {
        return null;
      }
      return { fingerprint: record.fingerprint, result: record.result };
    } catch (err) {
      this.logger.warn({ err, referenceId }, 'idempotency cache read failed');
      return null;
    }
  }
}

function cacheKey(referenceId: string): string {
  return `idem:${referenceId}`;
}
