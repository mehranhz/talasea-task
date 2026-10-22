import type { Types } from 'mongoose';

export const TransactionType = {
  Deposit: 'DEPOSIT',
  Withdrawal: 'WITHDRAWAL',
  TransferOut: 'TRANSFER_OUT',
  TransferIn: 'TRANSFER_IN',
} as const;

export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const Direction = {
  Credit: 'CREDIT',
  Debit: 'DEBIT',
} as const;

export type Direction = (typeof Direction)[keyof typeof Direction];

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
