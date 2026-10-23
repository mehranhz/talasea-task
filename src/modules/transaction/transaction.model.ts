import mongoose, { Schema } from 'mongoose';
import { Direction, TransactionType, type TransactionDoc } from './transaction.types';

// Append-only hot ledger. amount is at least one minor unit; balanceAfter cannot be stored negative.
// autoIndex stays off so these indexes are built by the explicit ensure step, not on first query.
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
    // The other wallet of a transfer. Deposits and withdrawals leave this empty.
    counterpartyWalletId: { type: Schema.Types.ObjectId, required: false },
    // Shared by both legs so history can treat a transfer as one movement.
    transferId: { type: Schema.Types.ObjectId, required: false },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false, autoIndex: false },
);

// History pages and per-wallet net both hint this index so they stay index scans.
transactionSchema.index({ walletId: 1, _id: -1 });
// Not unique: a transfer writes two legs with the same referenceId. Idempotency lives elsewhere.
transactionSchema.index({ referenceId: 1 });

export const TransactionModel = mongoose.model<TransactionDoc>(
  'Transaction',
  transactionSchema,
  'transactions',
);

// Same shape as the hot ledger. Rows move here without any write to wallet.balance.
const archiveSchema = transactionSchema.clone();

export const TransactionArchiveModel = mongoose.model<TransactionDoc>(
  'TransactionArchive',
  archiveSchema,
  'transactions_archive',
);

// Archived credit-minus-debit per wallet. Reconciliation adds this to the hot net.
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
