import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { Redis } from 'ioredis';
import { loadEnv } from '../../src/config/env';
import { createLogger } from '../../src/config/logger';
import { OutboxRepository } from '../../src/modules/outbox/outbox.repository';
import { OutboxModel } from '../../src/modules/outbox/outbox.model';
import { OutboxRelayProcessor } from '../../src/modules/queue/processors/outbox-relay.processor';
import { QueueService } from '../../src/modules/queue/queue.service';
import { createE2EContext, type E2EContext } from './helpers/context';
import { api, ref } from './helpers/http';

describe('wallet core e2e', () => {
  let ctx: E2EContext;

  before(async () => {
    ctx = await createE2EContext('core');
  });

  after(async () => {
    await ctx.teardown();
  });

  /** One wallet per user and asset, a non-negative debit, an atomic transfer, and a history page that does not repeat ids. */
  it('creates wallet, deposit, withdraw, transfer, history cursor, error envelope', async () => {
    const userA = `user-a-${ref('u')}`;
    const userB = `user-b-${ref('u')}`;

    const created = await api<{ id: string; balance: string; version: number }>(ctx.baseUrl, '/api/v1/wallets', {
      method: 'POST',
      body: JSON.stringify({ userId: userA, asset: 'USD' }),
    });
    assert.equal(created.ok, true);
    assert.equal(created.status, 201);
    if (!created.ok) return;
    assert.equal(created.data.balance, '0');
    assert.equal(created.data.version, 0);
    assert.ok(typeof created.meta.requestId === 'string');

    const walletA = created.data.id;
    const walletBRes = await api<{ id: string }>(ctx.baseUrl, '/api/v1/wallets', {
      method: 'POST',
      body: JSON.stringify({ userId: userB, asset: 'USD' }),
    });
    assert.equal(walletBRes.ok, true);
    if (!walletBRes.ok) return;
    const walletB = walletBRes.data.id;

    const dep = await api<{ balance: string; transactionId: string }>(
      ctx.baseUrl,
      `/api/v1/wallets/${walletA}/deposit`,
      { method: 'POST', body: JSON.stringify({ amount: '500', referenceId: ref('dep') }) },
    );
    assert.equal(dep.ok, true);
    if (!dep.ok) return;
    assert.equal(dep.data.balance, '500');

    const wd = await api<{ balance: string }>(ctx.baseUrl, `/api/v1/wallets/${walletA}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ amount: '100', referenceId: ref('wd') }),
    });
    assert.equal(wd.ok, true);
    if (!wd.ok) return;
    assert.equal(wd.data.balance, '400');

    await api(ctx.baseUrl, `/api/v1/wallets/${walletB}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount: '50', referenceId: ref('dep-b') }),
    });

    const xfer = await api<{ fromBalance: string; toBalance: string }>(ctx.baseUrl, '/api/v1/wallets/transfer', {
      method: 'POST',
      body: JSON.stringify({
        fromWalletId: walletA,
        toWalletId: walletB,
        amount: '75',
        referenceId: ref('xfer'),
      }),
    });
    assert.equal(xfer.ok, true);
    if (!xfer.ok) return;
    assert.equal(xfer.data.fromBalance, '325');
    assert.equal(xfer.data.toBalance, '125');

    const refs: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const r = ref(`hist-${i}`);
      refs.push(r);
      await api(ctx.baseUrl, `/api/v1/wallets/${walletA}/deposit`, {
        method: 'POST',
        body: JSON.stringify({ amount: '1', referenceId: r }),
      });
    }

    const page1 = await api<Array<{ id: string; referenceId: string }>>(
      ctx.baseUrl,
      `/api/v1/wallets/${walletA}/transactions?limit=2`,
    );
    assert.equal(page1.ok, true);
    if (!page1.ok) return;
    assert.equal(page1.data.length, 2);
    assert.ok(typeof page1.meta.nextCursor === 'string' && page1.meta.nextCursor.length > 0);

    const cursor = page1.meta.nextCursor as string;
    const page2 = await api<Array<{ id: string }>>(
      ctx.baseUrl,
      `/api/v1/wallets/${walletA}/transactions?limit=2&cursor=${encodeURIComponent(cursor)}`,
    );
    assert.equal(page2.ok, true);
    if (!page2.ok) return;
    assert.ok(page2.data.length >= 1);
    const ids1 = new Set(page1.data.map((row) => row.id));
    for (const row of page2.data) assert.ok(!ids1.has(row.id));

    const bal = await api<{ balance: string; version: number }>(ctx.baseUrl, `/api/v1/wallets/${walletA}/balance`);
    assert.equal(bal.ok, true);
    if (!bal.ok) return;
    assert.equal(bal.data.balance, '328');

    const same = await api(ctx.baseUrl, '/api/v1/wallets/transfer', {
      method: 'POST',
      body: JSON.stringify({
        fromWalletId: walletA,
        toWalletId: walletA,
        amount: '1',
        referenceId: ref('same'),
      }),
    });
    assert.equal(same.ok, false);
    if (same.ok) return;
    assert.equal(same.status, 422);
    assert.equal(same.error.code, 'SAME_WALLET_TRANSFER');

    const invalid = await api(ctx.baseUrl, `/api/v1/wallets/${walletA}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount: '0', referenceId: ref('zero') }),
    });
    assert.equal(invalid.ok, false);
    if (invalid.ok) return;
    assert.equal(invalid.status, 400);
    assert.equal(invalid.error.code, 'VALIDATION_ERROR');

    const missing = await api(ctx.baseUrl, `/api/v1/wallets/${'0'.repeat(23)}1/balance`);
    assert.equal(missing.ok, false);
    if (missing.ok) return;
    assert.equal(missing.status, 404);
    assert.equal(missing.error.code, 'WALLET_NOT_FOUND');
    assert.ok(typeof missing.meta.requestId === 'string');
    assert.deepEqual(Object.keys(missing.error).sort(), ['code', 'details', 'message']);
  });

  /** The outbox row exists because the deposit committed. Relay publishes it and then clears it. */
  it('relays the outbox row written with a committed deposit', async () => {
    const created = await api<{ id: string }>(ctx.baseUrl, '/api/v1/wallets', {
      method: 'POST',
      body: JSON.stringify({ userId: ref('outbox-user'), asset: 'USD' }),
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const referenceId = ref('outbox-dep');
    const dep = await api(ctx.baseUrl, `/api/v1/wallets/${created.data.id}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount: '3', referenceId }),
    });
    assert.equal(dep.ok, true);

    const pending = await OutboxModel.countDocuments({ publishedAt: null, 'payload.referenceId': referenceId });
    assert.equal(pending, 1);

    const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
    const queues = new QueueService(redis, createLogger(loadEnv()), '0 * * * *', '15 3 * * *');
    try {
      const relayed = await new OutboxRelayProcessor(new OutboxRepository(), queues, createLogger(loadEnv())).relay();
      assert.ok(relayed >= 1);
      const stillPending = await OutboxModel.countDocuments({ publishedAt: null, 'payload.referenceId': referenceId });
      assert.equal(stillPending, 0);
    } finally {
      await queues.close();
    }
  });
});
