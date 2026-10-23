import { Types } from 'mongoose';
import type { Logger } from 'pino';
import type { TransactionRepository } from '../../transaction/transaction.repository';

const BATCH = 200;

export class LedgerArchiveProcessor {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly logger: Logger,
    private readonly archiveAfterDays: number,
  ) {}

  async archive(): Promise<{ moved: number }> {
    const cutoff = Types.ObjectId.createFromTime(
      Math.floor(Date.now() / 1000) - this.archiveAfterDays * 24 * 60 * 60,
    );
    let moved = 0;
    for (;;) {
      const count = await this.transactionRepo.moveOldBatch(cutoff, BATCH);
      moved += count;
      if (count < BATCH) break;
    }
    this.logger.info({ moved, archiveAfterDays: this.archiveAfterDays }, 'ledger archive complete');
    return { moved };
  }
}
