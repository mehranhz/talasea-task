import type { Logger } from 'pino';
import type { NotificationPayload } from '../queue.types';

export class NotificationProcessor {
  constructor(private readonly logger: Logger) {}

  async process(payload: NotificationPayload): Promise<void> {
    this.logger.info(
      { outboxId: payload.outboxId, eventType: payload.eventType, payload: payload.payload },
      'notification',
    );
  }
}
