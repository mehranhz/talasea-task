export interface OutboxRelayPayload {
  kind: 'relay';
}

export interface NotificationPayload {
  outboxId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface ReconciliationPayload {
  kind: 'reconcile';
}
