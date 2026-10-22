import type { Container } from '../../core/Container';
import { Module } from '../../core/Module';
import { RateLimiter } from '../../common/http/rateLimiter';
import { WalletRepository } from '../wallet/wallet.repository';
import { TransactionController } from './transaction.controller';
import { TransactionRepository } from './transaction.repository';
import { buildTransactionRouter } from './transaction.routes';
import { TransactionService } from './transaction.service';

export class TransactionModule extends Module {
  override providers(c: Container): void {
    c.register(TransactionRepository, () => new TransactionRepository());
    c.register(
      TransactionService,
      (container) =>
        new TransactionService({
          transactionRepo: container.resolve(TransactionRepository),
          walletRepo: container.resolve(WalletRepository),
        }),
    );
    c.register(
      TransactionController,
      (container) => new TransactionController(container.resolve(TransactionService)),
    );
  }

  override routes(c: Container): { path: string; router: ReturnType<typeof buildTransactionRouter> } {
    return {
      path: '/api/v1/wallets',
      router: buildTransactionRouter(c.resolve(TransactionController), c.resolve(RateLimiter)),
    };
  }
}
