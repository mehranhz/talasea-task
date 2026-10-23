import mongoose from 'mongoose';
import { OperationModel } from '../modules/idempotency/operation.model';
import { OutboxModel } from '../modules/outbox/outbox.model';
import { LedgerRollupModel, TransactionArchiveModel, TransactionModel } from '../modules/transaction/transaction.model';
import { WalletModel } from '../modules/wallet/wallet.model';

/** Server-side backstop: a wallet balance cannot be stored below zero even if a writer skips the conditional debit. */
/** Database-side floor. A debit that would store a negative balance is rejected even if the handler is bypassed. */
/** Database-level floor. A debit that would store a negative balance is rejected even if the app check is skipped. */
const balanceValidator = {
  $jsonSchema: {
    bsonType: 'object',
    properties: {
      balance: { bsonType: ['double', 'int', 'long'], minimum: 0 },
    },
  },
};

/** Builds the indexes the money rules rely on: one wallet per user and asset, unique referenceId, and the history index on both the hot ledger and the archive. Then installs the balance validator. */
/** Builds the wallet, ledger, archive, rollup, idempotency, and outbox indexes, then installs the balance floor. */
/** Builds the indexes the money path depends on, then installs the non-negative balance validator. */
export async function ensureIndexes(): Promise<void> {
  await WalletModel.createIndexes();
  await TransactionModel.createIndexes();
  await TransactionArchiveModel.createIndexes();
  await LedgerRollupModel.createIndexes();
  await OperationModel.createIndexes();
  await OutboxModel.createIndexes();

  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected');
  const wallets = await db.listCollections({ name: 'wallets' }).toArray();
  if (wallets.length === 0) {
    await db.createCollection('wallets', { validator: balanceValidator, validationLevel: 'moderate' });
    return;
  }
  await db.command({
    collMod: 'wallets',
    validator: balanceValidator,
    validationLevel: 'moderate',
  });
}
