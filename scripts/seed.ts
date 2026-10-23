const baseUrl = process.env.API_URL ?? 'http://127.0.0.1:3000';
const count = Number(process.argv[2] ?? '10');

/** Creates wallets through the API so a local run has accounts to deposit into. */
async function main(): Promise<void> {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Usage: tsx scripts/seed.ts [count]');
  }

  const created: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const response = await fetch(`${baseUrl}/api/v1/wallets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: `seed-${Date.now()}-${index}`, asset: 'USD' }),
    });
    const body: unknown = await response.json();
    if (response.status !== 201) {
      throw new Error(`seed failed: ${response.status} ${JSON.stringify(body)}`);
    }
    const id = readId(body);
    created.push(id);
  }

  process.stdout.write(`seeded ${created.length} wallets\n`);
}

/** Takes the wallet id from the create response. Seed stops if that id is missing. */
function readId(body: unknown): string {
  if (!body || typeof body !== 'object' || !('data' in body)) {
    throw new Error('seed response missing data');
  }
  const data = (body as { data: unknown }).data;
  if (!data || typeof data !== 'object' || !('id' in data) || typeof (data as { id: unknown }).id !== 'string') {
    throw new Error('seed response missing id');
  }
  return (data as { id: string }).id;
}

void main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
