export const QueueName = {
  OutboxRelay: 'outbox-relay',
  Notifications: 'notifications',
  Reconciliation: 'reconciliation',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];
