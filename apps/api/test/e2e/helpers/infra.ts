import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const MONGO_HOST = '127.0.0.1';
const MONGO_PORT = 27_017;
const REDIS_HOST = '127.0.0.1';
const REDIS_PORT = 6379;

/** Points a suite at its own database on the published replica set. */
/** Points a suite at its own database on the published replica set. */
export function mongoUri(dbName: string): string {
  return `mongodb://${MONGO_HOST}:${MONGO_PORT}/${dbName}?replicaSet=rs0`;
}

/** Brings Mongo and Redis up when they are down. Money tests need a replica set, and the fail-open test still needs Mongo. */
export async function ensureInfra(): Promise<void> {
  const mongoUp = await portOpen(MONGO_HOST, MONGO_PORT);
  const redisUp = await portOpen(REDIS_HOST, REDIS_PORT);
  if (mongoUp && redisUp) return;

  await runDockerCompose(['up', '-d', 'mongo', 'redis']);
  await waitForPorts(
    [
      { host: MONGO_HOST, port: MONGO_PORT, label: 'mongo' },
      { host: REDIS_HOST, port: REDIS_PORT, label: 'redis' },
    ],
    120_000,
  );
}

/** True when something already accepts TCP, so Compose is not started twice. */
/** True when something already accepts TCP, so Compose is not started twice. */
function portOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok: boolean): void => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2_000);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/** Waits until Mongo and Redis accept connections. Tests cannot debit before the replica set is up. */
/** Waits until Mongo and Redis accept connections. Tests cannot debit before the replica set is up. */
async function waitForPorts(
  targets: Array<{ host: string; port: number; label: string }>,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const results = await Promise.all(targets.map((t) => portOpen(t.host, t.port)));
    if (results.every(Boolean)) return;
    await delay(1_000);
  }
  const missing: string[] = [];
  for (const target of targets) {
    if (!(await portOpen(target.host, target.port))) missing.push(target.label);
  }
  throw new Error(`Timed out waiting for: ${missing.join(', ')}`);
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Starts only the data services. The API under test is the in-process app, not the Compose api container. */
/** Starts only the data services. The API under test is the in-process app, not the Compose api container. */
function runDockerCompose(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['compose', ...args], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`docker compose ${args.join(' ')} exited ${code ?? 'unknown'}`));
    });
  });
}
