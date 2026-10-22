import type { Types } from 'mongoose';

export interface WalletDoc {
  _id: Types.ObjectId;
  userId: string;
  asset: string;
  balance: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BalanceSnapshot {
  asset: string;
  balance: number;
  version: number;
}
