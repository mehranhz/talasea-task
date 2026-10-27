import type { Direction, TransactionType } from "./ledger";

export interface CreatedWallet {
  id: string;
  userId: string;
  asset: string;
  balance: string;
  version: number;
  createdAt: string;
}

export interface Balance {
  walletId: string;
  asset: string;
  balance: string;
  version: number;
}

export interface Movement {
  walletId: string;
  asset: string;
  amount: string;
  balance: string;
  referenceId: string;
  transactionId: string;
  type: TransactionType;
}

export interface TransferResult {
  transferId: string;
  referenceId: string;
  asset: string;
  amount: string;
  fromWalletId: string;
  toWalletId: string;
  fromBalance: string;
  toBalance: string;
  fromTransactionId: string;
  toTransactionId: string;
}

export interface LedgerRow {
  id: string;
  walletId: string;
  userId: string;
  asset: string;
  type: TransactionType;
  direction: Direction;
  amount: string;
  balanceAfter: string;
  referenceId: string;
  counterpartyWalletId: string | null;
  transferId: string | null;
  createdAt: string;
}

export interface ApiMeta {
  requestId?: string;
  nextCursor?: string | null;
  limit?: number;
}
