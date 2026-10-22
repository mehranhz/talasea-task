import mongoose from 'mongoose';
import { OperationModel } from '../modules/idempotency/operation.model';
import { OutboxModel } from '../modules/outbox/outbox.model';
import { TransactionModel } from '../modules/transaction/transaction.model';
import { WalletModel } from '../modules/wallet/wallet.model';

const balanceValidator = {
  $jsonSchema: {
    bsonType: 'object',
    properties: {
      balance: { bsonType: ['double', 'int', 'long'], minimum: 0 },
    },
  },
};

export async function ensureIndexes(): Promise<void> {
  await WalletModel.createIndexes();
  await TransactionModel.createIndexes();
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
