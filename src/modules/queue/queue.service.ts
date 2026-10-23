import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { QueueName } from './queue.names';
import type {
  LedgerArchivePayload,
  NotificationPayload,
  OutboxRelayPayload,
  ReconciliationPayload,
} from './queue.types';

const COMPLETE_RETENTION = { age: 60 * 60, count: 1_000 };
const FAIL_RETENTION = { age: 7 * 24 * 60 * 60, count: 5_000 };

export class QueueService {
  readonly relayQueue: Queue<OutboxRelayPayload>;
  readonly notificationQueue: Queue<NotificationPayload>;
  readonly reconciliationQueue: Queue<ReconciliationPayload>;
  readonly archiveQueue: Queue<LedgerArchivePayload>;
  private readonly connections: Redis[] = [];

  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly reconciliationCron: string,
    private readonly archiveCron: string,
  ) {
    this.relayQueue = new Queue<OutboxRelayPayload>(QueueName.OutboxRelay, {
      connection: this.duplicate(),
      defaultJobOptions: {
        removeOnComplete: COMPLETE_RETENTION,
        removeOnFail: FAIL_RETENTION,
      },
    });
    this.notificationQueue = new Queue<NotificationPayload>(QueueName.Notifications, {
      connection: this.duplicate(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: COMPLETE_RETENTION,
        removeOnFail: FAIL_RETENTION,
      },
    });
    this.reconciliationQueue = new Queue<ReconciliationPayload>(QueueName.Reconciliation, {
      connection: this.duplicate(),
      defaultJobOptions: {
        removeOnComplete: COMPLETE_RETENTION,
        removeOnFail: FAIL_RETENTION,
      },
    });
    this.archiveQueue = new Queue<LedgerArchivePayload>(QueueName.LedgerArchive, {
      connection: this.duplicate(),
      defaultJobOptions: {
        removeOnComplete: COMPLETE_RETENTION,
        removeOnFail: FAIL_RETENTION,
      },
    });
  }

  duplicate(): Redis {
    const connection = this.redis.duplicate();
    connection.on('error', (err: Error) => {
      this.logger.warn({ err: err.message }, 'bullmq redis error');
    });
    this.connections.push(connection);
    return connection;
  }

  async schedule(): Promise<void> {
    await this.relayQueue.upsertJobScheduler(
      'outbox-relay',
      { every: 2_000 },
      { name: 'relay', data: { kind: 'relay' } },
    );
    await this.reconciliationQueue.upsertJobScheduler(
      'reconciliation',
      { pattern: this.reconciliationCron },
      { name: 'reconcile', data: { kind: 'reconcile' } },
    );
    await this.archiveQueue.upsertJobScheduler(
      'ledger-archive',
      { pattern: this.archiveCron },
      { name: 'archive', data: { kind: 'archive' } },
    );
  }

  async enqueueNotification(data: NotificationPayload): Promise<void> {
    try {
      await this.notificationQueue.add('send', data, { jobId: data.outboxId });
    } catch (err) {
      if (isAlreadyQueued(err)) return;
      throw err;
    }
  }

  createWorker<T>(name: QueueName, concurrency: number, processor: (job: { data: T }) => Promise<void>): Worker<T> {
    const worker = new Worker<T>(name, async (job) => processor({ data: job.data }), {
      connection: this.duplicate(),
      concurrency,
    });
    worker.on('failed', (job, err) => {
      this.logger.error({ err, queue: name, jobId: job?.id }, 'job failed');
    });
    return worker;
  }

  async close(): Promise<void> {
    await this.relayQueue.close();
    await this.notificationQueue.close();
    await this.reconciliationQueue.close();
    await this.archiveQueue.close();
    await Promise.all(
      this.connections.map(async (connection) => {
        try {
          await connection.quit();
        } catch {
          connection.disconnect();
        }
      }),
    );
    this.redis.disconnect();
  }
}

function isAlreadyQueued(err: unknown): boolean {
  return err instanceof Error && (err.message.includes('already exists') || err.message.includes('Job is already'));
}
