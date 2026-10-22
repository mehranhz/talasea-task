import { Types, type ClientSession, type FilterQuery } from 'mongoose';
import { TransactionModel } from './transaction.model';
import type { NewTransaction, TransactionDoc, TransactionType } from './transaction.types';

export class TransactionRepository {
  async insert(input: NewTransaction, session: ClientSession): Promise<TransactionDoc> {
    const created = await TransactionModel.create([{ ...input, createdAt: new Date() }], { session });
    const doc = created[0];
    if (!doc) throw new Error('Transaction insert returned no document');
    return doc.toObject();
  }

  async list(input: {
    walletId: Types.ObjectId;
    limit: number;
    cursorId?: Types.ObjectId;
    type?: TransactionType;
  }): Promise<TransactionDoc[]> {
    const filter: FilterQuery<TransactionDoc> = { walletId: input.walletId };
    if (input.cursorId) filter._id = { $lt: input.cursorId };
    if (input.type) filter.type = input.type;
    return TransactionModel.find(filter)
      .sort({ _id: -1 })
      .hint({ walletId: 1, _id: -1 })
      .limit(input.limit)
      .select({
        walletId: 1,
        userId: 1,
        asset: 1,
        type: 1,
        direction: 1,
        amount: 1,
        balanceAfter: 1,
        referenceId: 1,
        counterpartyWalletId: 1,
        transferId: 1,
        createdAt: 1,
      })
      .lean<TransactionDoc[]>()
      .exec();
  }

  async netForWallet(walletId: Types.ObjectId): Promise<number> {
    const rows = await TransactionModel.aggregate<{ _id: null; net: number }>([
      { $match: { walletId } },
      {
        $group: {
          _id: null,
          net: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'CREDIT'] }, '$amount', { $multiply: ['$amount', -1] }],
            },
          },
        },
      },
    ]).exec();
    return rows[0]?.net ?? 0;
  }
}
