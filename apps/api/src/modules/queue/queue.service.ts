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

  /** Opens the four queues: outbox relay, notifications, reconciliation, and ledger archive. */
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
    // Retries are safe: enqueue uses the outbox id as the job id, so each row is still one job.
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

  /** One Redis connection per queue or worker. BullMQ must not share a connection that is also in subscriber mode. */
  duplicate(): Redis {
    const connection = this.redis.duplicate();
    // Log the socket error so it is not an unhandled crash. This listener does not write wallet.balance.
    connection.on('error', (err: Error) => {
      this.logger.warn({ err: err.message }, 'bullmq redis error');
    });
    this.connections.push(connection);
    return connection;
  }

  /** Registers the repeating jobs. Upsert keeps one scheduler per name, so a restart does not double-run archive or reconciliation. */
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

  /**
   * Queues one notification keyed by the outbox id.
   * A duplicate job id is a replay of the same event, so it is ignored instead of delivering twice.
   */
  async enqueueNotification(data: NotificationPayload): Promise<void> {
    try {
      await this.notificationQueue.add('send', data, { jobId: data.outboxId });
    } catch (err) {
      // The row was already queued. Skip it; do not credit or notify again.
      if (isAlreadyQueued(err)) return;
      throw err;
    }
  }

  /** Starts a worker. Failures are logged; none of these jobs write wallet.balance themselves. */
  createWorker<T>(name: QueueName, concurrency: number, processor: (job: { data: T }) => Promise<void>): Worker<T> {
    const worker = new Worker<T>(
      name,
      // Pass the payload through. The processor does not write wallet.balance.
      async (job) => processor({ data: job.data }),
      {
        connection: this.duplicate(),
        concurrency,
      },
    );
    // Record the failure for inspection. Logging it does not repair drift or replay a debit.
    worker.on('failed', (job, err) => {
      this.logger.error({ err, queue: name, jobId: job?.id }, 'job failed');
    });
    return worker;
  }

  /** Closes queues before Redis so an in-flight archive batch can finish its transaction. */
  async close(): Promise<void> {
    await this.relayQueue.close();
    await this.notificationQueue.close();
    await this.reconciliationQueue.close();
    await this.archiveQueue.close();
    await Promise.all(
      this.connections.map(
        // Quit so an in-flight command can finish. Disconnect if the server does not answer.
        async (connection) => {
          try {
            await connection.quit();
          } catch {
            connection.disconnect();
          }
        },
      ),
    );
    this.redis.disconnect();
  }
}

/** True when BullMQ rejected a second job with the same outbox id. */
function isAlreadyQueued(err: unknown): boolean {
  return err instanceof Error && (err.message.includes('already exists') || err.message.includes('Job is already'));
}
