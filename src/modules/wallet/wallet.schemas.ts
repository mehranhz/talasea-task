import { z } from 'zod';

export const createWalletSchema = z
  .object({
    userId: z.string().min(1).max(128),
    asset: z.string().min(1).max(16),
  })
  .strict();

export const walletIdParamsSchema = z
  .object({
    walletId: z.string().regex(/^[a-fA-F0-9]{24}$/),
  })
  .strict();

export const moneyBodySchema = z
  .object({
    amount: z.string().regex(/^[1-9][0-9]{0,12}$/),
    referenceId: z.string().min(1).max(128),
  })
  .strict();

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
