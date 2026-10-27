import { Types, type ClientSession } from 'mongoose';
import type { MinorUnits } from '../../common/money';
import { WalletModel } from './wallet.model';
import type { BalanceSnapshot, WalletDoc } from './wallet.types';

/** Drops the Mongoose wrapper so callers see the stored balance and version, not a document proxy. */
function plainWallet(doc: { toObject(): WalletDoc }): WalletDoc {
  return doc.toObject();
}

export class WalletRepository {
  /** Inserts a wallet at balance 0 and version 0. A duplicate (userId, asset) is left for the caller to map. */
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

  /** Loads one wallet. Null means the id does not exist. */
  async findById(id: Types.ObjectId): Promise<WalletDoc | null> {
    return WalletModel.findById(id).lean<WalletDoc>().exec();
  }

  /** Loads both sides of a transfer in one query, before any lock is taken. */
  async findManyByIds(ids: Types.ObjectId[]): Promise<WalletDoc[]> {
    return WalletModel.find({ _id: { $in: ids } }).lean<WalletDoc[]>().exec();
  }

  /** Reads only the fields the balance cache stores. An optional session keeps the read on the transaction snapshot. */
  async findBalance(id: Types.ObjectId, session?: ClientSession): Promise<BalanceSnapshot | null> {
    const query = WalletModel.findById(id).select({ asset: 1, balance: 1, version: 1 }).lean<BalanceSnapshot>();
    if (session) query.session(session);
    const doc = await query.exec();
    if (!doc) return null;
    return { asset: doc.asset, balance: doc.balance, version: doc.version };
  }

  /** Adds amount and bumps version. Unconditional: a credit cannot break the non-negative balance rule. */
  async credit(id: Types.ObjectId, amount: MinorUnits, session: ClientSession): Promise<WalletDoc | null> {
    return WalletModel.findOneAndUpdate(
      { _id: id },
      { $inc: { balance: amount, version: 1 }, $set: { updatedAt: new Date() } },
      { new: true, session },
    )
      .lean<WalletDoc>()
      .exec();
  }

  /**
   * Subtracts amount only while balance is already at least that amount.
   * The filter is what keeps concurrent debits from going negative; a miss returns null and writes nothing.
   */
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

  /** Tells a missing wallet from a debit that failed the balance check. Use the same session as that debit. */
  async exists(id: Types.ObjectId, session?: ClientSession): Promise<boolean> {
    const query = WalletModel.exists({ _id: id });
    if (session) query.session(session);
    const found = await query.exec();
    return found !== null;
  }

  /** Pages wallets by _id for reconciliation. The cursor is the last id, so an insert during the scan is not skipped or repeated. */
  async listBatch(after: Types.ObjectId | null, limit: number): Promise<WalletDoc[]> {
    const filter = after ? { _id: { $gt: after } } : {};
    return WalletModel.find(filter)
      .sort({ _id: 1 })
      .select({ balance: 1 })
      .limit(limit)
      .lean<WalletDoc[]>()
      .exec();
  }
}
