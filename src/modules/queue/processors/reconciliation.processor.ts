import { Types } from 'mongoose';
import type { Logger } from 'pino';
import { withMongoTransaction } from '../../../common/withMongoTransaction';
import type { TransactionRepository } from '../../transaction/transaction.repository';
import type { WalletRepository } from '../../wallet/wallet.repository';

const BATCH = 1_000;

export class ReconciliationProcessor {
  constructor(
    private readonly walletRepo: WalletRepository,
    private readonly transactionRepo: TransactionRepository,
    private readonly logger: Logger,
  ) {}

  async reconcile(): Promise<{ scanned: number; mismatches: number }> {
    let scanned = 0;
    let mismatches = 0;
    let after: Types.ObjectId | null = null;

    for (;;) {
      const wallets = await this.walletRepo.listBatch(after, BATCH);
      if (wallets.length === 0) break;
      const ids = wallets.map((wallet) => wallet._id);
      const hot = await this.transactionRepo.netByWallet(ids);
      const archived = await this.transactionRepo.archivedNetByWallet(ids);

      for (const wallet of wallets) {
        const id = wallet._id.toHexString();
        const net = (hot.get(id) ?? 0) + (archived.get(id) ?? 0);
        if (net === wallet.balance) continue;
        if (await this.matches(wallet._id)) continue;
        mismatches += 1;
        this.logger.error({ walletId: id, balance: wallet.balance, ledgerNet: net }, 'balance mismatch');
      }

      scanned += wallets.length;
      const last = wallets[wallets.length - 1];
      if (!last || wallets.length < BATCH) break;
      after = last._id;
    }

    this.logger.info({ scanned, mismatches }, 'reconciliation complete');
    return { scanned, mismatches };
  }

  private async matches(walletId: Types.ObjectId): Promise<boolean> {
    return withMongoTransaction(async (session) => {
      const snapshot = await this.walletRepo.findBalance(walletId, session);
      if (!snapshot) return false;
      const id = walletId.toHexString();
      const hot = await this.transactionRepo.netByWallet([walletId], session);
      const archived = await this.transactionRepo.archivedNetByWallet([walletId], session);
      return (hot.get(id) ?? 0) + (archived.get(id) ?? 0) === snapshot.balance;
    });
  }
}
