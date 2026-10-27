export const TransactionType = {
  Deposit: "DEPOSIT",
  Withdrawal: "WITHDRAWAL",
  TransferOut: "TRANSFER_OUT",
  TransferIn: "TRANSFER_IN",
} as const;

export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const Direction = {
  Credit: "CREDIT",
  Debit: "DEBIT",
} as const;

export type Direction = (typeof Direction)[keyof typeof Direction];
