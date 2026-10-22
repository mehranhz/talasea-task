const baseUrl = process.env.API_URL ?? 'http://127.0.0.1:3000';

interface Envelope {
  data?: {
    id?: string;
    balance?: string;
    transactionId?: string;
  };
  error?: { code?: string };
}

async function main(): Promise<void> {
  const stamp = Date.now().toString(36);
  const walletA = await createWallet(`demo-a-${stamp}`);
  const walletB = await createWallet(`demo-b-${stamp}`);
  const walletC = await createWallet(`demo-c-${stamp}`);
  const walletD = await createWallet(`demo-d-${stamp}`);

  await deposit(walletA, '10', `fund-a-${stamp}`);
  const caseA = await caseWithdrawals(walletA);
  await deposit(walletB, '5', `shared-${stamp}`, 50);
  const caseB = await readBalance(walletB);
  await deposit(walletC, '1000', `fund-c-${stamp}`);
  await deposit(walletD, '1000', `fund-d-${stamp}`);
  const beforeC = await readBalance(walletC);
  const beforeD = await readBalance(walletD);
  const caseC = await caseTransfers(walletC, walletD);
  const afterC = await readBalance(walletC);
  const afterD = await readBalance(walletD);

  const expectedA = caseA.successes === 10 && caseA.insufficient === 90 && (await readBalance(walletA)) === 0;
  const expectedB = caseB === 5;
  const conserved = beforeC + beforeD === afterC + afterD;
  const expectedTotal = 0 + 5 + afterC + afterD;
  const actualTotal = (await readBalance(walletA)) + caseB + afterC + afterD;
  const totalOk = actualTotal === expectedTotal && actualTotal === 5 + 2000;

  print('a', expectedA, `successes=${caseA.successes} insufficient=${caseA.insufficient} other=${caseA.other}`);
  print('b', expectedB, `balance=${caseB}`);
  print('c', caseC.failed === 0 && conserved, `ok=${caseC.ok} rejected=${caseC.rejected} failed=${caseC.failed} sum=${afterC + afterD}`);
  process.stdout.write(`total=${actualTotal} expected=${5 + 2000} ${totalOk ? 'PASS' : 'FAIL'}\n`);

  if (!expectedA || !expectedB || caseC.failed !== 0 || !conserved || !totalOk) {
    process.exit(1);
  }
}

function print(name: string, ok: boolean, detail: string): void {
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}\n`);
}

async function caseWithdrawals(walletId: string): Promise<{ successes: number; insufficient: number; other: number }> {
  const results = await Promise.all(
    Array.from({ length: 100 }, (_, index) =>
      request(`/api/v1/wallets/${walletId}/withdraw`, {
        amount: '1',
        referenceId: `wd-${walletId}-${index}`,
      }),
    ),
  );
  return {
    successes: results.filter((result) => result.status === 200).length,
    insufficient: results.filter((result) => result.status === 422).length,
    other: results.filter((result) => result.status !== 200 && result.status !== 422).length,
  };
}

async function caseTransfers(
  fromWalletId: string,
  toWalletId: string,
): Promise<{ ok: number; rejected: number; failed: number }> {
  const requests = [
    ...Array.from({ length: 100 }, (_, index) =>
      request('/api/v1/wallets/transfer', {
        fromWalletId,
        toWalletId,
        amount: '1',
        referenceId: `tf-ab-${fromWalletId}-${index}`,
      }),
    ),
    ...Array.from({ length: 100 }, (_, index) =>
      request('/api/v1/wallets/transfer', {
        fromWalletId: toWalletId,
        toWalletId: fromWalletId,
        amount: '1',
        referenceId: `tf-ba-${toWalletId}-${index}`,
      }),
    ),
  ];
  const results = await Promise.all(requests);
  return {
    ok: results.filter((result) => result.status === 200).length,
    rejected: results.filter((result) => result.status === 422 || result.status === 503).length,
    failed: results.filter((result) => result.status !== 200 && result.status !== 422 && result.status !== 503).length,
  };
}

async function createWallet(userId: string): Promise<string> {
  const result = await request('/api/v1/wallets', { userId, asset: 'USD' });
  if (result.status !== 201 || !result.body.data?.id) {
    throw new Error(`create wallet failed: ${result.status} ${JSON.stringify(result.body)}`);
  }
  return result.body.data.id;
}

async function deposit(walletId: string, amount: string, referenceId: string, times = 1): Promise<void> {
  const results = await Promise.all(
    Array.from({ length: times }, () =>
      request(`/api/v1/wallets/${walletId}/deposit`, { amount, referenceId }),
    ),
  );
  const failed = results.find((result) => result.status !== 200);
  if (failed) {
    throw new Error(`deposit failed: ${failed.status} ${JSON.stringify(failed.body)}`);
  }
}

async function readBalance(walletId: string): Promise<number> {
  const response = await fetch(`${baseUrl}/api/v1/wallets/${walletId}/balance`);
  const body = (await response.json()) as Envelope;
  if (response.status !== 200 || !body.data?.balance) {
    throw new Error(`balance failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return Number(body.data.balance);
}

async function request(path: string, payload: Record<string, string>): Promise<{ status: number; body: Envelope }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45_000),
  });
  const body = (await response.json()) as Envelope;
  return { status: response.status, body };
}

void main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
