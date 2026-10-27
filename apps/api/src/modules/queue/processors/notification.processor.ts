import type { Logger } from 'pino';
import type { NotificationPayload } from '../queue.types';

export class NotificationProcessor {
  /** Keeps the logger for delivery. Notifications do not own the debit. */
  constructor(private readonly logger: Logger) {}

  /** Logs a delivered outbox event. Delivery does not credit, debit, or change wallet.balance. */
  async process(payload: NotificationPayload): Promise<void> {
    this.logger.info(
      { outboxId: payload.outboxId, eventType: payload.eventType, payload: payload.payload },
      'notification',
    );
  }
}
