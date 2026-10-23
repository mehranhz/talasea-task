import { z } from 'zod';

/** Owner and asset are required, so a wallet cannot be opened without knowing whose balance it is. */
export const createWalletSchema = z
  .object({
    userId: z.string().min(1).max(128),
    asset: z.string().min(1).max(16),
  })
  .strict();

/** Wallet ids are 24-hex ObjectIds, so a movement cannot target a malformed id. */
export const walletIdParamsSchema = z
  .object({
    walletId: z.string().regex(/^[a-fA-F0-9]{24}$/),
  })
  .strict();

/** Positive integer amount plus a referenceId, so a credit or debit can be replayed instead of applied twice. */
export const moneyBodySchema = z
  .object({
    amount: z.string().regex(/^[1-9][0-9]{0,12}$/),
    referenceId: z.string().min(1).max(128),
  })
  .strict();

/** Both wallets, a positive amount, and a referenceId. The service still rejects a same-wallet or cross-asset move. */
export const transferBodySchema = z
  .object({
    fromWalletId: z.string().regex(/^[a-fA-F0-9]{24}$/),
    toWalletId: z.string().regex(/^[a-fA-F0-9]{24}$/),
    amount: z.string().regex(/^[1-9][0-9]{0,12}$/),
    referenceId: z.string().min(1).max(128),
  })
  .strict();

export type CreateWalletBody = z.infer<typeof createWalletSchema>;
export type WalletIdParams = z.infer<typeof walletIdParamsSchema>;
export type MoneyBody = z.infer<typeof moneyBodySchema>;
export type TransferBody = z.infer<typeof transferBodySchema>;
