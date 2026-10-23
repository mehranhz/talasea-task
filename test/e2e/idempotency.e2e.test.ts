import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import mongoose from 'mongoose';
import { OperationModel } from '../../src/modules/idempotency/operation.model';
import { TransactionModel } from '../../src/modules/transaction/transaction.model';
import { createE2EContext, type E2EContext } from './helpers/context';
import { api, ref } from './helpers/http';

describe('idempotency e2e', () => {
  let ctx: E2EContext;

  before(async () => {
    ctx = await createE2EContext('idem');
  });

  after(async () => {
    await ctx.teardown();
  });

  async function createFundedWallet(amount: string): Promise<string> {
    const userId = ref('user');
    const w = await api<{ id: string }>(ctx.baseUrl, '/api/v1/wallets', {
      method: 'POST',
      body: JSON.stringify({ userId, asset: 'USD' }),
    });
    assert.equal(w.ok, true);
    if (!w.ok) throw new Error('wallet create failed');
    await api(ctx.baseUrl, `/api/v1/wallets/${w.data.id}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount, referenceId: ref('fund') }),
    });
    return w.data.id;
  }

  it('replays identical money requests and sets Idempotency-Replayed', async () => {
    const walletId = await createFundedWallet('1000');
    const referenceId = ref('replay');
    const body = JSON.stringify({ amount: '10', referenceId });

    const first = await api(ctx.baseUrl, `/api/v1/wallets/${walletId}/deposit`, { method: 'POST', body });
    const second = await api(ctx.baseUrl, `/api/v1/wallets/${walletId}/deposit`, { method: 'POST', body });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(first.headers.get('Idempotency-Replayed'), null);
    assert.equal(second.headers.get('Idempotency-Replayed'), 'true');
    assert.deepEqual(first.data, second.data);

    const txCount = await TransactionModel.countDocuments({ referenceId });
    assert.equal(txCount, 1);
  });

  it('returns 409 when referenceId is reused with a different fingerprint', async () => {
    const walletId = await createFundedWallet('500');
    const referenceId = ref('conflict');
    const ok = await api(ctx.baseUrl, `/api/v1/wallets/${walletId}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount: '10', referenceId }),
    });
    assert.equal(ok.ok, true);

    const conflict = await api(ctx.baseUrl, `/api/v1/wallets/${walletId}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount: '11', referenceId }),
    });
    assert.equal(conflict.ok, false);
    if (conflict.ok) return;
    assert.equal(conflict.status, 409);
    assert.equal(conflict.error.code, 'IDEMPOTENCY_KEY_REUSED');
  });

  it('parallel duplicate referenceId creates one ledger row', async () => {
    const walletId = await createFundedWallet('0');
    const referenceId = ref('parallel');
    const body = JSON.stringify({ amount: '25', referenceId });
    const attempts = 24;
    const results = await Promise.all(
      Array.from({ length: attempts }, () =>
        api(ctx.baseUrl, `/api/v1/wallets/${walletId}/deposit`, { method: 'POST', body }),
      ),
    );
    assert.ok(results.every((r) => r.ok));
    const txCount = await TransactionModel.countDocuments({ referenceId });
    assert.equal(txCount, 1);
    const opCount = await OperationModel.countDocuments({ referenceId });
    assert.equal(opCount, 1);

    const bal = await api<{ balance: string }>(ctx.baseUrl, `/api/v1/wallets/${walletId}/balance`);
    assert.equal(bal.ok, true);
    if (!bal.ok) return;
    assert.equal(bal.data.balance, '25');
  });

  it('insufficient funds does not consume the idempotency key', async () => {
    const userId = ref('empty');
    const w = await api<{ id: string }>(ctx.baseUrl, '/api/v1/wallets', {
      method: 'POST',
      body: JSON.stringify({ userId, asset: 'USD' }),
    });
    assert.equal(w.ok, true);
    if (!w.ok) return;
    const walletId = w.data.id;
    const referenceId = ref('insuf');

    const fail = await api(ctx.baseUrl, `/api/v1/wallets/${walletId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ amount: '100', referenceId }),
    });
    assert.equal(fail.ok, false);
    if (fail.ok) return;
    assert.equal(fail.status, 422);
    assert.equal(fail.error.code, 'INSUFFICIENT_FUNDS');

    const opsAfterFail = await OperationModel.countDocuments({ referenceId });
    assert.equal(opsAfterFail, 0);

    await api(ctx.baseUrl, `/api/v1/wallets/${walletId}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount: '100', referenceId: ref('fund2') }),
    });

    const retry = await api(ctx.baseUrl, `/api/v1/wallets/${walletId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ amount: '100', referenceId }),
    });
    assert.equal(retry.ok, true);
    if (!retry.ok) return;

    const opsAfterSuccess = await OperationModel.countDocuments({ referenceId });
    assert.equal(opsAfterSuccess, 1);
    assert.equal(await TransactionModel.countDocuments({ referenceId }), 1);
  });
});
