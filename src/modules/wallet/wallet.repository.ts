import { Types, type ClientSession } from 'mongoose';
import type { MinorUnits } from '../../common/money';
import { WalletModel } from './wallet.model';
import type { BalanceSnapshot, WalletDoc } from './wallet.types';

function plainWallet(doc: { toObject(): WalletDoc }): WalletDoc {
  return doc.toObject();
}

export class WalletRepository {
  async insert(input: { userId: string; asset: string }): Promise<WalletDoc> {
    const now = new Date();
    const created = await WalletModel.create([
      {
        userId: input.userId,
        asset: input.asset,
        balance: 0,
        version: 0,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const doc = created[0];
    if (!doc) throw new Error('Wallet insert returned no document');
    return plainWallet(doc);
  }

  async findById(id: Types.ObjectId): Promise<WalletDoc | null> {
    return WalletModel.findById(id).lean<WalletDoc>().exec();
  }

  async findManyByIds(ids: Types.ObjectId[]): Promise<WalletDoc[]> {
    return WalletModel.find({ _id: { $in: ids } }).lean<WalletDoc[]>().exec();
  }

  async findBalance(id: Types.ObjectId): Promise<BalanceSnapshot | null> {
    const doc = await WalletModel.findById(id)
      .select({ asset: 1, balance: 1, version: 1 })
      .lean<BalanceSnapshot>()
      .exec();
    if (!doc) return null;
    return { asset: doc.asset, balance: doc.balance, version: doc.version };
  }

  async credit(id: Types.ObjectId, amount: MinorUnits, session: ClientSession): Promise<WalletDoc | null> {
    return WalletModel.findOneAndUpdate(
      { _id: id },
      { $inc: { balance: amount, version: 1 }, $set: { updatedAt: new Date() } },
      { new: true, session },
    )
      .lean<WalletDoc>()
      .exec();
  }

  async debitIfSufficient(
    id: Types.ObjectId,
    amount: MinorUnits,
    session: ClientSession,
  ): Promise<WalletDoc | null> {
    return WalletModel.findOneAndUpdate(
      { _id: id, balance: { $gte: amount } },
      { $inc: { balance: -amount, version: 1 }, $set: { updatedAt: new Date() } },
      { new: true, session },
    )
      .lean<WalletDoc>()
      .exec();
  }

  async exists(id: Types.ObjectId, session?: ClientSession): Promise<boolean> {
    const query = WalletModel.exists({ _id: id });
    if (session) query.session(session);
    const found = await query.exec();
    return found !== null;
  }

  scan(batchSize: number): AsyncIterable<WalletDoc> {
    return WalletModel.find().sort({ _id: 1 }).lean<WalletDoc>().cursor({ batchSize });
  }
}
