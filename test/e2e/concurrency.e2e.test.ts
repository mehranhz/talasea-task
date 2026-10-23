import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import mongoose, { Types } from 'mongoose';
import { WalletModel } from '../../src/modules/wallet/wallet.model';
import { createE2EContext, type E2EContext } from './helpers/context';
import { api, ref } from './helpers/http';

describe('concurrency e2e', () => {
  let ctx: E2EContext;

  before(async () => {
    ctx = await createE2EContext('conc');
  });

  after(async () => {
    await ctx.teardown();
  });

  async function newWallet(userId: string): Promise<string> {
    const w = await api<{ id: string }>(ctx.baseUrl, '/api/v1/wallets', {
      method: 'POST',
      body: JSON.stringify({ userId, asset: 'USD' }),
    });
    assert.equal(w.ok, true);
    if (!w.ok) throw new Error('create wallet failed');
    return w.data.id;
  }

  it('100-way withdrawals cannot overdraw one wallet', async () => {
    const walletId = await newWallet(ref('overdraft'));
    const fundRef = ref('fund');
    const fund = await api(ctx.baseUrl, `/api/v1/wallets/${walletId}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount: '50', referenceId: fundRef }),
    });
    assert.equal(fund.ok, true);

    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        api(ctx.baseUrl, `/api/v1/wallets/${walletId}/withdraw`, {
          method: 'POST',
          body: JSON.stringify({ amount: '1', referenceId: ref(`wd-${i}`) }),
        }),
      ),
    );

    const okCount = results.filter((r) => r.ok).length;
    const insufficient = results.filter((r) => !r.ok && r.status === 422).length;
    const unavailable = results.filter((r) => !r.ok && r.status === 503).length;
    const internal = results.filter((r) => r.status === 500);
    assert.equal(internal.length, 0);
    assert.equal(okCount + insufficient + unavailable, 100);
    assert.ok(okCount <= 50);

    const bal = await api<{ balance: string }>(ctx.baseUrl, `/api/v1/wallets/${walletId}/balance`);
    assert.equal(bal.ok, true);
    if (!bal.ok) return;
    assert.equal(Number(bal.data.balance), 50 - okCount);

    const doc = await WalletModel.findById(walletId).lean<{ balance: number }>();
    assert.ok(doc);
    assert.equal(doc.balance, 50 - okCount);
    assert.ok(doc.balance >= 0);
  });

  it('opposing transfers conserve total balance', async () => {
    const walletA = await newWallet(ref('opp-a'));
    const walletB = await newWallet(ref('opp-b'));
    for (const [id, amt] of [
      [walletA, '1000'],
      [walletB, '1000'],
    ] as const) {
      const d = await api(ctx.baseUrl, `/api/v1/wallets/${id}/deposit`, {
        method: 'POST',
        body: JSON.stringify({ amount: amt, referenceId: ref('seed') }),
      });
      assert.equal(d.ok, true);
    }

    const amount = '100';
    const rounds = 20;
    const jobs: Promise<unknown>[] = [];
    for (let i = 0; i < rounds; i += 1) {
      jobs.push(
        api(ctx.baseUrl, '/api/v1/wallets/transfer', {
          method: 'POST',
          body: JSON.stringify({
            fromWalletId: walletA,
            toWalletId: walletB,
            amount,
            referenceId: ref(`a-b-${i}`),
          }),
        }),
      );
      jobs.push(
        api(ctx.baseUrl, '/api/v1/wallets/transfer', {
          method: 'POST',
          body: JSON.stringify({
            fromWalletId: walletB,
            toWalletId: walletA,
            amount,
            referenceId: ref(`b-a-${i}`),
          }),
        }),
      );
    }
    const outcomes = await Promise.all(jobs);
    assert.ok(outcomes.every((r) => (r as { status: number }).status < 500));

    const sum = await sumBalances([walletA, walletB]);
    assert.equal(sum, 2000);
  });

  it('balance cache tracks wallet version after writes', async () => {
    const walletId = await newWallet(ref('cache'));
    const before = await api<{ version: number; balance: string }>(
      ctx.baseUrl,
      `/api/v1/wallets/${walletId}/balance`,
    );
    assert.equal(before.ok, true);
    if (!before.ok) return;
    assert.equal(before.data.version, 0);

    await api(ctx.baseUrl, `/api/v1/wallets/${walletId}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount: '5', referenceId: ref('c1') }),
    });
    await api(ctx.baseUrl, `/api/v1/wallets/${walletId}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount: '7', referenceId: ref('c2') }),
    });

    const after = await api<{ version: number; balance: string }>(
      ctx.baseUrl,
      `/api/v1/wallets/${walletId}/balance`,
    );
    assert.equal(after.ok, true);
    if (!after.ok) return;
    assert.equal(after.data.balance, '12');
    assert.ok(after.data.version > before.data.version);
    assert.equal(after.data.version, 2);
  });

  it('concurrent writes and balance reads avoid HTTP 500 and conserve balances', async () => {
    const wallets = await Promise.all(Array.from({ length: 8 }, (_, i) => newWallet(ref(`mix-${i}`))));
    for (const id of wallets) {
      await api(ctx.baseUrl, `/api/v1/wallets/${id}/deposit`, {
        method: 'POST',
        body: JSON.stringify({ amount: '1000', referenceId: ref('seed-mix') }),
      });
    }

    const tasks: Promise<{ status: number }>[] = [];
    for (let i = 0; i < 60; i += 1) {
      const from = wallets[i % wallets.length]!;
      const to = wallets[(i + 1) % wallets.length]!;
      if (i % 3 === 0) {
        tasks.push(
          api(ctx.baseUrl, `/api/v1/wallets/${from}/deposit`, {
            method: 'POST',
            body: JSON.stringify({ amount: '1', referenceId: ref(`dep-${i}`) }),
          }),
        );
      } else if (i % 3 === 1) {
        tasks.push(
          api(ctx.baseUrl, `/api/v1/wallets/${from}/withdraw`, {
            method: 'POST',
            body: JSON.stringify({ amount: '1', referenceId: ref(`wd-${i}`) }),
          }),
        );
      } else {
        tasks.push(
          api(ctx.baseUrl, '/api/v1/wallets/transfer', {
            method: 'POST',
            body: JSON.stringify({
              fromWalletId: from,
              toWalletId: to,
              amount: '2',
              referenceId: ref(`xfer-${i}`),
            }),
          }),
        );
      }
      tasks.push(api(ctx.baseUrl, `/api/v1/wallets/${from}/balance`));
    }

    const results = await Promise.all(tasks);
    const fiveHundred = results.filter((r) => r.status >= 500);
    assert.equal(fiveHundred.length, 0);

    const total = await sumBalances(wallets);
    assert.equal(total, wallets.length * 1000);
  });
});

async function sumBalances(walletIds: string[]): Promise<number> {
  const ids = walletIds.map((id) => new Types.ObjectId(id));
  const rows = await WalletModel.find({ _id: { $in: ids } })
    .select({ balance: 1 })
    .lean<Array<{ balance: number }>>();
  return rows.reduce((acc, row) => acc + row.balance, 0);
}
