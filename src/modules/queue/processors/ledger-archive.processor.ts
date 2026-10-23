import { Types } from 'mongoose';
import type { Logger } from 'pino';
import type { TransactionRepository } from '../../transaction/transaction.repository';

const BATCH = 200;

export class LedgerArchiveProcessor {
  /** Keeps the retention window for the archive cron, which moves old rows and does not change wallet.balance. */
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly logger: Logger,
    private readonly archiveAfterDays: number,
  ) {}

  /**
   * Moves ledger rows older than the retention window into the archive, one batch at a time.
   * Each batch updates the rollup and does not change wallet.balance.
   */
  async archive(): Promise<{ moved: number }> {
    // ObjectId time is the row's insert time, so the cutoff selects history without scanning createdAt.
    const cutoff = Types.ObjectId.createFromTime(
      Math.floor(Date.now() / 1000) - this.archiveAfterDays * 24 * 60 * 60,
    );
    let moved = 0;
    for (;;) {
      const count = await this.transactionRepo.moveOldBatch(cutoff, BATCH);
      moved += count;
      // A short batch is the end of this pass. Those rows are already in the rollup, not in wallet.balance.
      if (count < BATCH) break;
    }
    this.logger.info({ moved, archiveAfterDays: this.archiveAfterDays }, 'ledger archive complete');
    return { moved };
  }
}
