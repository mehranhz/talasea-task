import { Router } from 'express';
import type { RateLimiter } from '../../common/http/rateLimiter';
import { validate } from '../../common/http/validate';
import { walletIdParamsSchema } from '../wallet/wallet.schemas';
import type { TransactionController } from './transaction.controller';
import { historyQuerySchema } from './transaction.schemas';

export function buildTransactionRouter(controller: TransactionController, limiter: RateLimiter): Router {
  const router = Router();
  router.get(
    '/:walletId/transactions',
    limiter.limit(),
    validate({ params: walletIdParamsSchema, query: historyQuerySchema }),
    controller.history,
  );
  return router;
}
