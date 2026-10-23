import { Types, type ClientSession, type FilterQuery } from 'mongoose';
import { withMongoTransaction } from '../../common/withMongoTransaction';
import { Direction } from './transaction.types';
import { LedgerRollupModel, TransactionArchiveModel, TransactionModel } from './transaction.model';
import type { NewTransaction, TransactionDoc, TransactionType } from './transaction.types';

const NET = {
  $sum: {
    $cond: [{ $eq: ['$direction', 'CREDIT'] }, '$amount', { $multiply: ['$amount', -1] }],
  },
};

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

  async netByWallet(walletIds: Types.ObjectId[], session?: ClientSession): Promise<Map<string, number>> {
    return groupedNet(TransactionModel, walletIds, session);
  }

  async archivedNetByWallet(walletIds: Types.ObjectId[], session?: ClientSession): Promise<Map<string, number>> {
    if (walletIds.length === 0) return new Map();
    const query = LedgerRollupModel.find({ _id: { $in: walletIds } })
      .select({ net: 1 })
      .lean<Array<{ _id: Types.ObjectId; net: number }>>();
    if (session) query.session(session);
    const rows = await query.exec();
    const nets = new Map<string, number>();
    for (const row of rows) nets.set(row._id.toHexString(), row.net);
    return nets;
  }

  async moveOldBatch(cutoff: Types.ObjectId, limit: number): Promise<number> {
    const docs = await TransactionModel.find({ _id: { $lt: cutoff } })
      .sort({ _id: 1 })
      .limit(limit)
      .lean<TransactionDoc[]>()
      .exec();
    if (docs.length === 0) return 0;

    const ids = docs.map((doc) => doc._id);
    return withMongoTransaction(async (session) => {
      await TransactionArchiveModel.insertMany(docs, { session, ordered: true });
      await LedgerRollupModel.bulkWrite(rollupIncrements(docs), { session });
      const deleted = await TransactionModel.deleteMany({ _id: { $in: ids } }, { session });
      if (deleted.deletedCount !== docs.length) {
        throw new Error('archive batch changed before commit');
      }
      return docs.length;
    });
  }
}

async function groupedNet(
  model: typeof TransactionModel,
  walletIds: Types.ObjectId[],
  session?: ClientSession,
): Promise<Map<string, number>> {
  if (walletIds.length === 0) return new Map();
  const aggregate = model
    .aggregate<{ _id: Types.ObjectId; net: number }>([
      { $match: { walletId: { $in: walletIds } } },
      { $group: { _id: '$walletId', net: NET } },
    ])
    .hint({ walletId: 1, _id: -1 });
  if (session) aggregate.session(session);
  const rows = await aggregate.exec();
  const nets = new Map<string, number>();
  for (const row of rows) nets.set(row._id.toHexString(), row.net);
  return nets;
}

function rollupIncrements(docs: TransactionDoc[]) {
  const nets = new Map<string, number>();
  for (const doc of docs) {
    const key = doc.walletId.toHexString();
    const delta = doc.direction === Direction.Credit ? doc.amount : -doc.amount;
    nets.set(key, (nets.get(key) ?? 0) + delta);
  }
  return [...nets].map(([hex, net]) => ({
    updateOne: {
      filter: { _id: new Types.ObjectId(hex) },
      update: { $inc: { net } },
      upsert: true,
    },
  }));
}
