import { formatAmount } from '../../common/money';
import { clampLimit, decodeCursor, encodeCursor } from '../../common/pagination';
import { WalletNotFoundError } from '../../common/errors/errors';
import type { WalletRepository } from '../wallet/wallet.repository';
import type { TransactionRepository } from './transaction.repository';
import type { TransactionDoc, TransactionType } from './transaction.types';
import type { Types } from 'mongoose';

export interface HistoryPage {
  rows: Record<string, unknown>[];
  nextCursor: string | null;
  limit: number;
}

export interface TransactionServiceDeps {
  transactionRepo: TransactionRepository;
  walletRepo: WalletRepository;
}

export class TransactionService {
  constructor(private readonly deps: TransactionServiceDeps) {}

  /**
   * Pages the hot ledger for one wallet. Requests one extra row so a cursor is
   * returned only when another page exists. Archived rows are not in this list.
   */
  async history(
    walletId: Types.ObjectId,
    query: { limit?: number; cursor?: string; type?: TransactionType },
  ): Promise<HistoryPage> {
    const exists = await this.deps.walletRepo.exists(walletId);
    if (!exists) throw new WalletNotFoundError(walletId.toHexString());

    const limit = clampLimit(query.limit);
    const cursorId = query.cursor ? decodeCursor(query.cursor) : undefined;
    // One extra row tells a full page from the last page without a second query.
    const rows = await this.deps.transactionRepo.list({
      walletId,
      limit: limit + 1,
      cursorId,
      type: query.type,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    return {
      rows: page.map(presentTransaction),
      nextCursor: hasMore && last ? encodeCursor(last._id) : null,
      limit,
    };
  }
}

function presentTransaction(doc: TransactionDoc): Record<string, unknown> {
  return {
    id: doc._id.toHexString(),
    walletId: doc.walletId.toHexString(),
    userId: doc.userId,
    asset: doc.asset,
    type: doc.type,
    direction: doc.direction,
    amount: formatAmount(doc.amount),
    balanceAfter: formatAmount(doc.balanceAfter),
    referenceId: doc.referenceId,
    counterpartyWalletId: doc.counterpartyWalletId ? doc.counterpartyWalletId.toHexString() : null,
    transferId: doc.transferId ? doc.transferId.toHexString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}
