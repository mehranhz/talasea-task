import mongoose, { Schema } from 'mongoose';
import { Direction, TransactionType, type TransactionDoc } from './transaction.types';

const transactionSchema = new Schema<TransactionDoc>(
  {
    walletId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: String, required: true },
    asset: { type: String, required: true },
    type: { type: String, required: true, enum: Object.values(TransactionType) },
    direction: { type: String, required: true, enum: Object.values(Direction) },
    amount: { type: Number, required: true, min: 1 },
    balanceAfter: { type: Number, required: true, min: 0 },
    referenceId: { type: String, required: true },
    counterpartyWalletId: { type: Schema.Types.ObjectId, required: false },
    transferId: { type: Schema.Types.ObjectId, required: false },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false, autoIndex: false },
);

transactionSchema.index({ walletId: 1, _id: -1 });
transactionSchema.index({ referenceId: 1 });

export const TransactionModel = mongoose.model<TransactionDoc>(
  'Transaction',
  transactionSchema,
  'transactions',
);

const archiveSchema = transactionSchema.clone();

export const TransactionArchiveModel = mongoose.model<TransactionDoc>(
  'TransactionArchive',
  archiveSchema,
  'transactions_archive',
);

const rollupSchema = new Schema(
  {
    net: { type: Number, required: true, default: 0 },
  },
  { versionKey: false, autoIndex: false },
);

export interface LedgerRollupDoc {
  _id: mongoose.Types.ObjectId;
  net: number;
}

export const LedgerRollupModel = mongoose.model<LedgerRollupDoc>(
  'LedgerRollup',
  rollupSchema,
  'ledger_rollups',
);
