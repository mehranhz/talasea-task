import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { Types } from 'mongoose';
import { loadEnv } from '../../src/config/env';
import { createLogger } from '../../src/config/logger';
import { LedgerArchiveProcessor } from '../../src/modules/queue/processors/ledger-archive.processor';
import { ReconciliationProcessor } from '../../src/modules/queue/processors/reconciliation.processor';
import {
  LedgerRollupModel,
  TransactionArchiveModel,
  TransactionModel,
} from '../../src/modules/transaction/transaction.model';
import { TransactionRepository } from '../../src/modules/transaction/transaction.repository';
import { Direction, TransactionType } from '../../src/modules/transaction/transaction.types';
import { WalletModel } from '../../src/modules/wallet/wallet.model';
import { WalletRepository } from '../../src/modules/wallet/wallet.repository';
import { createE2EContext, type E2EContext } from './helpers/context';
import { executionStats, explainHistory, idAt, winningStages } from './helpers/ledger';

const DAY_SECONDS = 24 * 60 * 60;

describe('ledger archive and reconciliation e2e', () => {
  let ctx: E2EContext;

  before(async () => {
    ctx = await createE2EContext('ledger');
  });

  after(async () => {
    await ctx.teardown();
  });

  it('archives old rows, updates rollups, history uses IXSCAN, reconciliation detects mismatch', async () => {
    const env = loadEnv();
    const logger = createLogger(env);
    const transactionRepo = new TransactionRepository();
    const walletRepo = new WalletRepository();
    const archive = new LedgerArchiveProcessor(transactionRepo, logger, env.LEDGER_ARCHIVE_AFTER_DAYS);
    const reconciliation = new ReconciliationProcessor(walletRepo, transactionRepo, logger);

    const stamp = Date.now().toString(36);
    const OLD_ROWS = 201;
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
    assert.equal(first.moved, OLD_ROWS + 2);

    const hotA = await TransactionModel.countDocuments({ walletId: walletA });
    const coldA = await TransactionArchiveModel.countDocuments({ walletId: walletA });
    assert.equal(hotA, 1);
    assert.equal(coldA, OLD_ROWS);

    const rollupA = await rollupNet(walletA);
    const rollupC = await rollupNet(walletC);
    assert.equal(rollupA, OLD_ROWS);
    assert.equal(rollupC, 0);

    const history = await transactionRepo.list({ walletId: walletA, limit: 20 });
    assert.equal(history.length, 1);
    assert.equal(history[0]?._id.toHexString(), recentA.toHexString());

    const plan = await explainHistory(walletA, 20);
    const stages = winningStages(plan);
    const stats = executionStats(plan);
    assert.ok(stages.includes('IXSCAN'));
    assert.ok(!stages.includes('SORT'));
    assert.ok(stats.docs <= 1);
    assert.equal(stats.returned, 1);

    const clean = await reconciliation.reconcile();
    assert.equal(clean.mismatches, 0);
    assert.ok(clean.scanned >= 3);

    await WalletModel.updateOne({ _id: walletA }, { $set: { balance: 1 } });
    const broken = await reconciliation.reconcile();
    assert.equal(broken.mismatches, 1);

    await WalletModel.updateOne({ _id: walletA }, { $set: { balance: OLD_ROWS + 7 } });
    const restored = await reconciliation.reconcile();
    assert.equal(restored.mismatches, 0);
  });
});

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
    userId: 'ledger-e2e',
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
