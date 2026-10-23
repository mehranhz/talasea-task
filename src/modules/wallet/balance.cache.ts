import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { BalanceSnapshot } from './wallet.types';

const NEGATIVE_TTL_SECONDS = 10;

/** Keeps the higher version. An older snapshot must not replace a balance written later. */
const SET_IF_NEWER = `
local raw = redis.call('GET', KEYS[1])
if raw then
  local ok, decoded = pcall(cjson.decode, raw)
  if ok and type(decoded) == 'table' and decoded.version ~= nil and decoded.missing ~= true then
    if tonumber(decoded.version) >= tonumber(ARGV[2]) then
      return 0
    end
  end
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', tonumber(ARGV[3]))
return 1
`;

interface CacheHit extends BalanceSnapshot {
  missing?: false;
}

export class BalanceCache {
  private readonly inflight = new Map<string, Promise<BalanceSnapshot | null>>();

  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly ttlSeconds: number,
  ) {}

  /** Cached balance, or Mongo on a miss. Redis is a fast path; it is not the balance of record. */
  async get(
    walletId: string,
    loader: () => Promise<BalanceSnapshot | null>,
  ): Promise<BalanceSnapshot | null> {
    const cached = await this.read(walletId);
    if (cached === 'missing') return null;
    if (cached) return cached;

    const pending = this.inflight.get(walletId);
    if (pending) return pending;

    const promise = this.load(walletId, loader);
    this.inflight.set(walletId, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(walletId);
    }
  }

  /** Stores this snapshot only when its version wins. A cache error is logged and does not undo the commit. */
  async setIfNewer(walletId: string, snapshot: BalanceSnapshot): Promise<void> {
    try {
      const ttl = jitter(this.ttlSeconds);
      const payload = JSON.stringify({
        balance: snapshot.balance,
        version: snapshot.version,
        asset: snapshot.asset,
      });
      await this.redis.eval(SET_IF_NEWER, 1, key(walletId), payload, String(snapshot.version), String(ttl));
    } catch (err) {
      this.logger.warn({ err, walletId }, 'balance cache write failed');
    }
  }

  /** Loads Mongo after a miss. A wallet that does not exist is remembered briefly, then returned as missing. */
  private async load(
    walletId: string,
    loader: () => Promise<BalanceSnapshot | null>,
  ): Promise<BalanceSnapshot | null> {
    const snapshot = await loader();
    if (!snapshot) {
      await this.rememberMissing(walletId);
      return null;
    }
    await this.setIfNewer(walletId, snapshot);
    return snapshot;
  }

  /** Reads one cached snapshot. A bad payload or a Redis error is a miss, so the caller loads Mongo. */
  private async read(walletId: string): Promise<BalanceSnapshot | 'missing' | null> {
    try {
      const raw = await this.redis.get(key(walletId));
      if (raw === null) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if ('missing' in parsed && (parsed as { missing?: unknown }).missing === true) return 'missing';
      const hit = parsed as Partial<CacheHit>;
      if (typeof hit.balance !== 'number' || typeof hit.version !== 'number' || typeof hit.asset !== 'string') {
        return null;
      }
      return { balance: hit.balance, version: hit.version, asset: hit.asset };
    } catch (err) {
      this.logger.warn({ err, walletId }, 'balance cache read failed');
      return null;
    }
  }

  /** Caches a missing wallet for a few seconds so a bad id is not looked up on every read. */
  private async rememberMissing(walletId: string): Promise<void> {
    try {
      await this.redis.set(key(walletId), JSON.stringify({ missing: true }), 'EX', NEGATIVE_TTL_SECONDS);
    } catch (err) {
      this.logger.warn({ err, walletId }, 'negative cache write failed');
    }
  }
}

/** One key per wallet so one cached balance cannot be served as another. */
function key(walletId: string): string {
  return `wb:${walletId}`;
}

/** Spreads expiry so many wallets do not fall through to Mongo at the same moment. */
function jitter(baseSeconds: number): number {
  const delta = baseSeconds * 0.2;
  const ttl = baseSeconds + (Math.random() * 2 - 1) * delta;
  return Math.max(1, Math.round(ttl));
}
