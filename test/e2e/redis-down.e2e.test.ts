import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createE2EContext, type E2EContext } from './helpers/context';
import { api, ref } from './helpers/http';

describe('redis down e2e', () => {
  let ctx: E2EContext;

  before(async () => {
    ctx = await createE2EContext('redis-down', { redisUrl: 'redis://127.0.0.1:6399' });
  });

  after(async () => {
    await ctx.teardown();
  });

  it('serves balance and a deposit from Mongo when Redis is unreachable', async () => {
    const created = await api<{ id: string }>(ctx.baseUrl, '/api/v1/wallets', {
      method: 'POST',
      body: JSON.stringify({ userId: ref('redis-down'), asset: 'USD' }),
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const dep = await api<{ balance: string }>(ctx.baseUrl, `/api/v1/wallets/${created.data.id}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount: '15', referenceId: ref('redis-dep') }),
    });
    assert.equal(dep.ok, true);
    if (!dep.ok) return;
    assert.equal(dep.data.balance, '15');

    const bal = await api<{ balance: string }>(ctx.baseUrl, `/api/v1/wallets/${created.data.id}/balance`);
    assert.equal(bal.ok, true);
    if (!bal.ok) return;
    assert.equal(bal.data.balance, '15');
    assert.equal(bal.status, 200);
  });
});
