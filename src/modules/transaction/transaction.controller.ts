import type { Request, Response } from 'express';
import { getValidated } from '../../common/http/validate';
import { toObjectId } from '../../common/objectId';
import type { WalletIdParams } from '../wallet/wallet.schemas';
import type { HistoryQuery } from './transaction.schemas';
import type { TransactionService } from './transaction.service';

export class TransactionController {
  constructor(private readonly transactions: TransactionService) {}

  /** One page of hot-ledger history on the wallet index. This read does not change wallet.balance. */
  history = async (req: Request, res: Response): Promise<void> => {
    const { params, query } = getValidated<unknown, WalletIdParams, HistoryQuery>(res);
    const page = await this.transactions.history(toObjectId(params.walletId), query);
    res.status(200).json({
      data: page.rows,
      meta: { requestId: req.requestId, nextCursor: page.nextCursor, limit: page.limit },
    });
  };
}
