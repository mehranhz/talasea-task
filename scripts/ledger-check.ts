import mongoose, { Types } from 'mongoose';
import { loadEnv } from '../src/config/env';
import { ensureIndexes } from '../src/config/indexes';
import { createLogger } from '../src/config/logger';
import { connectMongo, disconnectMongo } from '../src/config/mongo';
import { LedgerArchiveProcessor } from '../src/modules/queue/processors/ledger-archive.processor';
import { ReconciliationProcessor } from '../src/modules/queue/processors/reconciliation.processor';
import { LedgerRollupModel, TransactionArchiveModel, TransactionModel } from '../src/modules/transaction/transaction.model';
import { TransactionRepository } from '../src/modules/transaction/transaction.repository';
import { Direction, TransactionType } from '../src/modules/transaction/transaction.types';
import { WalletModel } from '../src/modules/wallet/wallet.model';
import { WalletRepository } from '../src/modules/wallet/wallet.repository';

const ARCHIVE_AFTER_DAYS = 90;
const OLD_ROWS = 201;
const DAY_SECONDS = 24 * 60 * 60;

async function main(): Promise<void> {
  const uri = checkDatabaseUri();
  process.env.MONGO_URI = uri;
  process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
  process.env.LOG_LEVEL = 'error';

  const env = loadEnv();
  const logger = createLogger(env);
  await connectMongo(env);
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected');
  await db.dropDatabase();
  await ensureIndexes();

  const transactionRepo = new TransactionRepository();
  const walletRepo = new WalletRepository();
  const archive = new LedgerArchiveProcessor(transactionRepo, logger, ARCHIVE_AFTER_DAYS);
  const reconciliation = new ReconciliationProcessor(walletRepo, transactionRepo, logger);
  const stamp = Date.now().toString(36);
  let failed = false;

  const check = (name: string, ok: boolean, detail: string): void => {
    process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}\n`);
    if (!ok) failed = true;
  };

  try {
    const walletA = await insertWallet(`ledger-a-${stamp}`, 201 + 7);
    const walletB = await insertWallet(`ledger-b-${stamp}`, 4);
    const walletC = await insertWallet(`ledger-c-${stamp}`, 0);
    const recentA = new Types.ObjectId();
    const recentB = new Types.ObjectId();

    await TransactionModel.insertMany([
      ...Array.from({ length: OLD_ROWS }, (_, index) =>
        row(walletA, idAt(120 * DAY_SECONDS, index), Direction.Credit, 1, `old-a-${index}`),
      ),
      row(walletA, recentA, Direction.Credit, 7, 'recent-a'),
      row(walletB, recentB, Direction.Credit, 4, 'recent-b'),
      row(walletC, idAt(130 * DAY_SECONDS, 1), Direction.Credit, 5, 'old-c-credit'),
      row(walletC, idAt(130 * DAY_SECONDS, 2), Direction.Debit, 5, 'old-c-debit'),
    ]);

    const first = await archive.archive();
    const hotA = await TransactionModel.countDocuments({ walletId: walletA });
    const coldA = await TransactionArchiveModel.countDocuments({ walletId: walletA });
    const hotOld = await TransactionModel.countDocuments({
      _id: { $lt: Types.ObjectId.createFromTime(Math.floor(Date.now() / 1000) - ARCHIVE_AFTER_DAYS * DAY_SECONDS) },
    });
    const rollupA = await rollupNet(walletA);
    const rollupC = await rollupNet(walletC);
    const recentStillHot = await TransactionModel.countDocuments({ _id: recentA });
    const recentNotCold = await TransactionArchiveModel.countDocuments({ _id: recentA });

    check('archive-moved', first.moved === OLD_ROWS + 2, `moved=${first.moved}`);
    check('hot-keeps-recent', hotA === 1 && recentStillHot === 1 && recentNotCold === 0, `hotA=${hotA}`);
    check('cold-has-old', coldA === OLD_ROWS && hotOld === 0, `coldA=${coldA} hotOld=${hotOld}`);
    check('rollup', rollupA === OLD_ROWS && rollupC === 0, `a=${rollupA ?? 'missing'} c=${rollupC ?? 'missing'}`);

    const second = await archive.archive();
    const rollupAfter = await rollupNet(walletA);
    check('archive-once', second.moved === 0 && rollupAfter === OLD_ROWS, `moved=${second.moved} rollup=${rollupAfter ?? 'missing'}`);

    const history = await transactionRepo.list({ walletId: walletA, limit: 20 });
    const historyIds = history.map((entry) => entry._id.toHexString());
    check(
      'history-hot-only',
      history.length === 1 && historyIds[0] === recentA.toHexString() && history[0]?.amount === 7,
      `rows=${history.length}`,
    );

    const plan = await TransactionModel.find({ walletId: walletA })
      .sort({ _id: -1 })
      .hint({ walletId: 1, _id: -1 })
      .limit(20)
      .explain('executionStats');
    const stageNames = winningStages(plan);
    const examined = executionStats(plan);
    check(
      'history-index',
      stageNames.includes('IXSCAN') && !stageNames.includes('SORT') && examined.docs <= 1 && examined.returned === 1,
      `stages=${stageNames.join(',') || 'none'} docs=${examined.docs} returned=${examined.returned}`,
    );

    const pages = await pagesOf(walletRepo, 1);
    check(
      'reconcile-pages',
      pages.length === 3 && new Set(pages).size === 3,
      `pages=${pages.length}`,
    );

    const clean = await reconciliation.reconcile();
    check('reconcile-clean', clean.scanned === 3 && clean.mismatches === 0, `scanned=${clean.scanned} mismatches=${clean.mismatches}`);

    await WalletModel.updateOne({ _id: walletA }, { $set: { balance: 1 } });
    const broken = await reconciliation.reconcile();
    check('reconcile-mismatch', broken.scanned === 3 && broken.mismatches === 1, `mismatches=${broken.mismatches}`);

    await WalletModel.updateOne({ _id: walletA }, { $set: { balance: OLD_ROWS + 7 } });
    const restored = await reconciliation.reconcile();
    check('reconcile-restored', restored.mismatches === 0, `mismatches=${restored.mismatches}`);
  } finally {
    await db.dropDatabase();
    await disconnectMongo();
  }

  if (failed) process.exit(1);
}

function checkDatabaseUri(): string {
  const raw = process.env.ARCHIVE_CHECK_MONGO_URI ?? process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/wallet?replicaSet=rs0';
  const normalized = raw.replace('mongodb://mongo:', 'mongodb://127.0.0.1:');
  const url = new URL(normalized);
  url.pathname = '/wallet_archive_check';
  url.searchParams.set('directConnection', 'true');
  return url.toString();
}

function idAt(secondsAgo: number, counter: number): Types.ObjectId {
  const seconds = Math.floor(Date.now() / 1000) - secondsAgo;
  const hex = `${seconds.toString(16).padStart(8, '0')}aaaaaaaaaa${counter.toString(16).padStart(6, '0')}`;
  return new Types.ObjectId(hex);
}

async function insertWallet(userId: string, balance: number): Promise<Types.ObjectId> {
  const now = new Date();
  const created = await WalletModel.create({
    userId,
    asset: 'USD',
    balance,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
  return created._id;
}

function row(
  walletId: Types.ObjectId,
  id: Types.ObjectId,
  direction: (typeof Direction)[keyof typeof Direction],
  amount: number,
  referenceId: string,
) {
  return {
    _id: id,
    walletId,
    userId: 'ledger-check',
    asset: 'USD',
    type: direction === Direction.Credit ? TransactionType.Deposit : TransactionType.Withdrawal,
    direction,
    amount,
    balanceAfter: 0,
    referenceId,
    createdAt: id.getTimestamp(),
  };
}

async function rollupNet(walletId: Types.ObjectId): Promise<number | null> {
  const doc = await LedgerRollupModel.findById(walletId).lean<{ net: number } | null>();
  return doc ? doc.net : null;
}

async function pagesOf(walletRepo: WalletRepository, limit: number): Promise<string[]> {
  const ids: string[] = [];
  let after: Types.ObjectId | null = null;
  for (;;) {
    const batch = await walletRepo.listBatch(after, limit);
    if (batch.length === 0) break;
    ids.push(...batch.map((wallet) => wallet._id.toHexString()));
    const last = batch[batch.length - 1];
    if (!last || batch.length < limit) break;
    after = last._id;
  }
  return ids;
}

function winningStages(plan: unknown): string[] {
  if (!plan || typeof plan !== 'object') return [];
  const record = plan as {
    executionStats?: { executionStages?: unknown };
    queryPlanner?: { winningPlan?: unknown };
  };
  const found: string[] = [];
  stages(record.executionStats?.executionStages, found);
  if (found.length === 0) stages(record.queryPlanner?.winningPlan, found);
  return found;
}

function stages(node: unknown, found: string[] = []): string[] {
  if (!node || typeof node !== 'object') return found;
  if ('stage' in node && typeof node.stage === 'string') found.push(node.stage);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) stages(item, found);
    } else {
      stages(value, found);
    }
  }
  return found;
}

function executionStats(plan: unknown): { docs: number; returned: number } {
  if (!plan || typeof plan !== 'object' || !('executionStats' in plan)) return { docs: -1, returned: -1 };
  const stats = plan.executionStats;
  if (!stats || typeof stats !== 'object') return { docs: -1, returned: -1 };
  const docs = 'totalDocsExamined' in stats && typeof stats.totalDocsExamined === 'number' ? stats.totalDocsExamined : -1;
  const returned = 'nReturned' in stats && typeof stats.nReturned === 'number' ? stats.nReturned : -1;
  return { docs, returned };
}

void main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
