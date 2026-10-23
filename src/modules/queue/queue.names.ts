export const QueueName = {
  OutboxRelay: 'outbox-relay',
  Notifications: 'notifications',
  Reconciliation: 'reconciliation',
  LedgerArchive: 'ledger-archive',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];
