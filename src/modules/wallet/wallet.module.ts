import type { Container } from '../../core/Container';
import { Module } from '../../core/Module';
import { CONFIG, LOGGER, REDIS } from '../../core/tokens';
import { RateLimiter } from '../../common/http/rateLimiter';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { OutboxRepository } from '../outbox/outbox.repository';
import { TransactionRepository } from '../transaction/transaction.repository';
import { BalanceCache } from './balance.cache';
import { WalletController } from './wallet.controller';
import { WalletRepository } from './wallet.repository';
import { buildWalletRouter } from './wallet.routes';
import { WalletService } from './wallet.service';

export class WalletModule extends Module {
  override providers(c: Container): void {
    c.register(WalletRepository, () => new WalletRepository());
    c.register(OutboxRepository, () => new OutboxRepository());
    c.register(
      BalanceCache,
      (container) =>
        new BalanceCache(
          container.resolve(REDIS),
          container.resolve(LOGGER),
          container.resolve(CONFIG).BALANCE_CACHE_TTL_SECONDS,
        ),
    );
    c.register(
      WalletService,
      (container) =>
        new WalletService({
          walletRepo: container.resolve(WalletRepository),
          transactionRepo: container.resolve(TransactionRepository),
          outboxRepo: container.resolve(OutboxRepository),
          idempotency: container.resolve(IdempotencyService),
          balanceCache: container.resolve(BalanceCache),
          supportedAssets: container.resolve(CONFIG).SUPPORTED_ASSETS,
          logger: container.resolve(LOGGER),
        }),
    );
    c.register(WalletController, (container) => new WalletController(container.resolve(WalletService)));
  }

  override routes(c: Container): { path: string; router: ReturnType<typeof buildWalletRouter> } {
    return {
      path: '/api/v1/wallets',
      router: buildWalletRouter(c.resolve(WalletController), c.resolve(RateLimiter)),
    };
  }
}
