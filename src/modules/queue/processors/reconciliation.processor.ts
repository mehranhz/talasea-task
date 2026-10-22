import type { Logger } from 'pino';
import type { TransactionRepository } from '../../transaction/transaction.repository';
import type { WalletRepository } from '../../wallet/wallet.repository';

export class ReconciliationProcessor {
  constructor(
    private readonly walletRepo: WalletRepository,
    private readonly transactionRepo: TransactionRepository,
    private readonly logger: Logger,
  ) {}

  async reconcile(): Promise<{ scanned: number; mismatches: number }> {
    let scanned = 0;
    let mismatches = 0;
    for await (const wallet of this.walletRepo.scan(200)) {
      scanned += 1;
      const net = await this.transactionRepo.netForWallet(wallet._id);
      if (net !== wallet.balance) {
        mismatches += 1;
        this.logger.error(
          {
            walletId: wallet._id.toHexString(),
            balance: wallet.balance,
            ledgerNet: net,
          },
          'balance mismatch',
        );
      }
    }
    this.logger.info({ scanned, mismatches }, 'reconciliation complete');
    return { scanned, mismatches };
  }
}
