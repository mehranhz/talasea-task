import type { Redis } from 'ioredis';
import type { Worker } from 'bullmq';
import type { Container } from '../../core/Container';
import { Module } from '../../core/Module';
import type { ProcessRole } from '../../core/role';
import { CONFIG, LOGGER } from '../../core/tokens';
import { createBullRedis } from '../../config/redis';
import { OutboxRepository } from '../outbox/outbox.repository';
import { TransactionRepository } from '../transaction/transaction.repository';
import { WalletRepository } from '../wallet/wallet.repository';
import { LedgerArchiveProcessor } from './processors/ledger-archive.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { OutboxRelayProcessor } from './processors/outbox-relay.processor';
import { ReconciliationProcessor } from './processors/reconciliation.processor';
import { QueueName } from './queue.names';
import { QueueService } from './queue.service';
import type { LedgerArchivePayload, NotificationPayload, OutboxRelayPayload, ReconciliationPayload } from './queue.types';

export class QueueModule extends Module {
  private workers: Worker[] = [];
  private bullRedis: Redis | null = null;
  private queueService: QueueService | null = null;

  /** Remembers the process role. Consumers for the four queues start only when the role is worker. */
  constructor(private readonly role: ProcessRole) {
    super();
  }

  /** Wires queues and processors. The BullMQ connection is created once and shared by the queues. */
  override providers(c: Container): void {
    c.register(
      QueueService,
      /** Builds the service that owns the four queue names and shares one BullMQ connection. */
      (container) => {
      if (!this.bullRedis) {
        this.bullRedis = createBullRedis(container.resolve(CONFIG), container.resolve(LOGGER));
      }
      const config = container.resolve(CONFIG);
      const service = new QueueService(
        this.bullRedis,
        container.resolve(LOGGER),
        config.RECONCILIATION_CRON,
        config.LEDGER_ARCHIVE_CRON,
      );
      this.queueService = service;
      return service;
    });
    c.register(
      OutboxRelayProcessor,
      /** Relay publishes only after the money transaction committed. */
      (container) =>
        new OutboxRelayProcessor(
          container.resolve(OutboxRepository),
          container.resolve(QueueService),
          container.resolve(LOGGER),
        ),
    );
    c.register(
      NotificationProcessor,
      /** Notifications do not own the debit. */
      (container) => new NotificationProcessor(container.resolve(LOGGER)),
    );
    c.register(
      ReconciliationProcessor,
      /** Reconciliation logs drift and does not repair wallet.balance. */
      (container) =>
        new ReconciliationProcessor(
          container.resolve(WalletRepository),
          container.resolve(TransactionRepository),
          container.resolve(LOGGER),
        ),
    );
    c.register(
      LedgerArchiveProcessor,
      /** The archive cron moves old rows and does not change wallet.balance. */
      (container) =>
        new LedgerArchiveProcessor(
          container.resolve(TransactionRepository),
          container.resolve(LOGGER),
          container.resolve(CONFIG).LEDGER_ARCHIVE_AFTER_DAYS,
        ),
    );
  }

  /** Worker role only. Starts one consumer for each of the four queue names. */
  override async onInit(c: Container): Promise<void> {
    if (this.role !== 'worker') return;
    const logger = c.resolve(LOGGER);
    const concurrency = c.resolve(CONFIG).WORKER_CONCURRENCY;
    const queues = c.resolve(QueueService);
    await queues.schedule();
    const relay = c.resolve(OutboxRelayProcessor);
    const notifications = c.resolve(NotificationProcessor);
    const reconciliation = c.resolve(ReconciliationProcessor);
    const archive = c.resolve(LedgerArchiveProcessor);

    this.workers = [
      queues.createWorker<OutboxRelayPayload>(
        QueueName.OutboxRelay,
        1,
        // Publish only after the money transaction committed.
        async () => {
          await relay.relay();
        },
      ),
      queues.createWorker<NotificationPayload>(
        QueueName.Notifications,
        concurrency,
        // Delivery does not own the debit.
        async (job) => {
          await notifications.process(job.data);
        },
      ),
      queues.createWorker<ReconciliationPayload>(
        QueueName.Reconciliation,
        1,
        // Log drift and do not repair wallet.balance.
        async () => {
          await reconciliation.reconcile();
        },
      ),
      queues.createWorker<LedgerArchivePayload>(
        QueueName.LedgerArchive,
        1,
        // Move old rows and do not change wallet.balance.
        async () => {
          await archive.archive();
        },
      ),
    ];
    logger.info({ concurrency }, 'workers started');
  }

  /** Closes workers before the four queues so a job that already started can finish. */
  override async onShutdown(_c: Container): Promise<void> {
    for (const worker of this.workers) {
      await worker.close();
    }
    this.workers = [];
    if (this.queueService) {
      await this.queueService.close();
      this.queueService = null;
    } else if (this.bullRedis) {
      this.bullRedis.disconnect();
    }
    this.bullRedis = null;
  }
}
