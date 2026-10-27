import type { Types } from 'mongoose';
import { Direction, TransactionType } from '@talasea/types';

export { Direction, TransactionType };

export interface TransactionDoc {
  _id: Types.ObjectId;
  walletId: Types.ObjectId;
  userId: string;
  asset: string;
  type: TransactionType;
  direction: Direction;
  amount: number;
  balanceAfter: number;
  referenceId: string;
  counterpartyWalletId?: Types.ObjectId;
  transferId?: Types.ObjectId;
  createdAt: Date;
}

export interface NewTransaction {
  walletId: Types.ObjectId;
  userId: string;
  asset: string;
  type: TransactionType;
  direction: Direction;
  amount: number;
  balanceAfter: number;
  referenceId: string;
  counterpartyWalletId?: Types.ObjectId;
  transferId?: Types.ObjectId;
}
