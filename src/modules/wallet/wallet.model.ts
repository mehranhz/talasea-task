import mongoose, { Schema } from 'mongoose';
import type { WalletDoc } from './wallet.types';

/** Stored balance cannot go below zero. Version increments on each movement so a stale cache can be rejected. */
const walletSchema = new Schema<WalletDoc>(
  {
    userId: { type: String, required: true },
    asset: { type: String, required: true },
    balance: { type: Number, required: true, min: 0 },
    version: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { versionKey: false, autoIndex: false },
);

/** One wallet per user and asset. A second insert fails instead of splitting that balance. */
walletSchema.index({ userId: 1, asset: 1 }, { unique: true });

export const WalletModel = mongoose.model<WalletDoc>('Wallet', walletSchema, 'wallets');
