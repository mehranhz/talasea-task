/** Four queue names, one stream each: outbox relay, notifications, reconciliation, and ledger archive. */
export const QueueName = {
  OutboxRelay: 'outbox-relay',
  Notifications: 'notifications',
  Reconciliation: 'reconciliation',
  LedgerArchive: 'ledger-archive',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];
