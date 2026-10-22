import { z } from 'zod';
import { TransactionType } from './transaction.types';

export const historyQuerySchema = z
  .object({
    limit: z.coerce.number().int().positive().optional(),
    cursor: z.string().min(1).optional(),
    type: z.enum([
      TransactionType.Deposit,
      TransactionType.Withdrawal,
      TransactionType.TransferOut,
      TransactionType.TransferIn,
    ]).optional(),
  })
  .strict();

export type HistoryQuery = z.infer<typeof historyQuerySchema>;
