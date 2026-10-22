import type { Logger } from 'pino';
import type { OutboxRepository } from '../../outbox/outbox.repository';
import type { QueueService } from '../queue.service';
import type { NotificationPayload } from '../queue.types';

const BATCH_SIZE = 200;

export class OutboxRelayProcessor {
  constructor(
    private readonly outboxRepo: OutboxRepository,
    private readonly queues: QueueService,
    private readonly logger: Logger,
  ) {}

  async relay(): Promise<number> {
    const rows = await this.outboxRepo.findUnpublished(BATCH_SIZE);
    const published = [];
    for (const row of rows) {
      const job: NotificationPayload = {
        outboxId: row._id.toHexString(),
        eventType: row.eventType,
        payload: row.payload,
      };
      await this.queues.enqueueNotification(job);
      published.push(row._id);
    }
    await this.outboxRepo.markPublished(published);
    if (published.length > 0) {
      this.logger.info({ count: published.length }, 'outbox relay published');
    }
    return published.length;
  }
}
