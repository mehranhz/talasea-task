import { Router } from 'express';
import type { RateLimiter } from '../../common/http/rateLimiter';
import { validate } from '../../common/http/validate';
import type { WalletController } from './wallet.controller';
import {
  createWalletSchema,
  moneyBodySchema,
  transferBodySchema,
  walletIdParamsSchema,
} from './wallet.schemas';

/** Wallet API. Transfer is registered before /:walletId so a transfer is not parsed as a wallet id. */
export function buildWalletRouter(controller: WalletController, limiter: RateLimiter): Router {
  const router = Router();
  const ipLimit = limiter.limit();
  const walletLimit = limiter.limit({ byWallet: true });

  router.post('/', ipLimit, validate({ body: createWalletSchema }), controller.create);
  router.post('/transfer', walletLimit, validate({ body: transferBodySchema }), controller.transfer);
  router.get('/:walletId/balance', validate({ params: walletIdParamsSchema }), controller.balance);
  router.post(
    '/:walletId/deposit',
    walletLimit,
    validate({ params: walletIdParamsSchema, body: moneyBodySchema }),
    controller.deposit,
  );
  router.post(
    '/:walletId/withdraw',
    walletLimit,
    validate({ params: walletIdParamsSchema, body: moneyBodySchema }),
    controller.withdraw,
  );
  return router;
}
