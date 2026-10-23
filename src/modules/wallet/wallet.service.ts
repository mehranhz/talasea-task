import { Types, type ClientSession } from 'mongoose';
import type { Logger } from 'pino';
import {
  AssetMismatchError,
  IdempotencyKeyReusedError,
  InsufficientFundsError,
  isDuplicateKeyError,
  SameWalletTransferError,
  WalletExistsError,
  WalletNotFoundError,
} from '../../common/errors/errors';
import { assertSupportedAsset, formatAmount, parseAmount, type MinorUnits } from '../../common/money';
import { withMongoTransaction } from '../../common/withMongoTransaction';
import type { IdempotencyService } from '../idempotency/idempotency.service';
import type { StoredResult } from '../idempotency/operation.types';
import type { OutboxRepository } from '../outbox/outbox.repository';
import type { TransactionRepository } from '../transaction/transaction.repository';
import { Direction, TransactionType } from '../transaction/transaction.types';
import type { BalanceCache } from './balance.cache';
import type { WalletRepository } from './wallet.repository';
import type { WalletDoc } from './wallet.types';

export interface WalletServiceDeps {
  walletRepo: WalletRepository;
  transactionRepo: TransactionRepository;
  outboxRepo: OutboxRepository;
  idempotency: IdempotencyService;
  balanceCache: BalanceCache;
  supportedAssets: readonly string[];
  logger: Logger;
}

export interface MoneyOutcome {
  statusCode: number;
  data: Record<string, unknown>;
  replayed: boolean;
}

export interface CreatedWallet {
  id: string;
  userId: string;
  asset: string;
  balance: string;
  version: number;
  createdAt: string;
}

export interface BalanceView {
  walletId: string;
  asset: string;
  balance: string;
  version: number;
}

const REPLAY_ATTEMPTS = 20;
const REPLAY_DELAY_MS = 100;

export class WalletService {
  constructor(private readonly deps: WalletServiceDeps) {}

  /** Opens a wallet at zero. A duplicate (userId, asset) is WalletExistsError, so one user cannot hold two wallets for the same asset. */
  async create(userId: string, asset: string): Promise<CreatedWallet> {
    assertSupportedAsset(asset, this.deps.supportedAssets);
    try {
      const wallet = await this.deps.walletRepo.insert({ userId, asset });
      return presentWallet(wallet);
    } catch (err) {
      if (isDuplicateKeyError(err)) throw new WalletExistsError(userId, asset);
      throw err;
    }
  }

  /** Reads balance from cache, then Mongo. A cache miss is normal; a missing wallet is an error. */
  async getBalance(walletId: Types.ObjectId): Promise<BalanceView> {
    const id = walletId.toHexString();
    const snapshot = await this.deps.balanceCache.get(id, () => this.deps.walletRepo.findBalance(walletId));
    if (!snapshot) throw new WalletNotFoundError(id);
    return {
      walletId: id,
      asset: snapshot.asset,
      balance: formatAmount(snapshot.balance),
      version: snapshot.version,
    };
  }

  /**
   * Credits once per referenceId. The ledger row, outbox event, and idempotency
   * record commit with the balance change, so a retry replays instead of crediting again.
   */
  async deposit(walletId: Types.ObjectId, amountRaw: string, referenceId: string): Promise<MoneyOutcome> {
    const amount = parseAmount(amountRaw);
    const wallet = await this.requireWallet(walletId);
    const fingerprint = this.deps.idempotency.fingerprint({
      type: TransactionType.Deposit,
      asset: wallet.asset,
      amount: formatAmount(amount),
      walletIds: [wallet._id.toHexString()],
    });
    const replay = await this.replayIfExists(referenceId, fingerprint);
    if (replay) return replay;

    try {
      // Credit, ledger, outbox, and idempotency row share one transaction. A failure rolls the credit back.
      const committed = await withMongoTransaction(async (session) => {
        const updated = await this.deps.walletRepo.credit(walletId, amount, session);
        if (!updated) throw new WalletNotFoundError(walletId.toHexString());
        const entry = await this.deps.transactionRepo.insert(
          {
            walletId: updated._id,
            userId: updated.userId,
            asset: updated.asset,
            type: TransactionType.Deposit,
            direction: Direction.Credit,
            amount,
            balanceAfter: updated.balance,
            referenceId,
          },
          session,
        );
        const result = stored(200, {
          walletId: updated._id.toHexString(),
          asset: updated.asset,
          amount: formatAmount(amount),
          balance: formatAmount(updated.balance),
          referenceId,
          transactionId: entry._id.toHexString(),
          type: TransactionType.Deposit,
        });
        await this.deps.outboxRepo.insert(
          { eventType: 'DEPOSIT_COMPLETED', payload: result.data },
          session,
        );
        await this.deps.idempotency.insert(
          { referenceId, type: TransactionType.Deposit, fingerprint, result },
          session,
        );
        return { result, wallets: [updated] };
      });
      await this.afterCommit(referenceId, fingerprint, committed.result, committed.wallets);
      this.deps.logger.info(
        { walletId: walletId.toHexString(), amount: formatAmount(amount), referenceId },
        'deposit committed',
      );
      return { ...committed.result, replayed: false };
    } catch (err) {
      // The other request already inserted this referenceId. Return its stored result; do not credit again.
      if (isDuplicateKeyError(err)) return this.replayAfterConflict(referenceId, fingerprint);
      throw err;
    }
  }

  /**
   * Debits only when the wallet can cover the amount. The same referenceId
   * returns the original result, so a retried withdrawal cannot debit twice.
   */
  async withdraw(walletId: Types.ObjectId, amountRaw: string, referenceId: string): Promise<MoneyOutcome> {
    const amount = parseAmount(amountRaw);
    const wallet = await this.requireWallet(walletId);
    const fingerprint = this.deps.idempotency.fingerprint({
      type: TransactionType.Withdrawal,
      asset: wallet.asset,
      amount: formatAmount(amount),
      walletIds: [wallet._id.toHexString()],
    });
    const replay = await this.replayIfExists(referenceId, fingerprint);
    if (replay) return replay;

    try {
      // Debit, ledger, outbox, and idempotency row commit together so a failed withdrawal cannot leave a debit without history.
      const committed = await withMongoTransaction(async (session) => {
        // Filter is balance >= amount, so a lost race cannot leave a negative balance.
        const updated = await this.deps.walletRepo.debitIfSufficient(walletId, amount, session);
        if (!updated) {
          // Same session as the debit: null is insufficient funds if the wallet exists, not-found otherwise.
          const exists = await this.deps.walletRepo.exists(walletId, session);
          throw exists
            ? new InsufficientFundsError(walletId.toHexString())
            : new WalletNotFoundError(walletId.toHexString());
        }
        const entry = await this.deps.transactionRepo.insert(
          {
            walletId: updated._id,
            userId: updated.userId,
            asset: updated.asset,
            type: TransactionType.Withdrawal,
            direction: Direction.Debit,
            amount,
            balanceAfter: updated.balance,
            referenceId,
          },
          session,
        );
        const result = stored(200, {
          walletId: updated._id.toHexString(),
          asset: updated.asset,
          amount: formatAmount(amount),
          balance: formatAmount(updated.balance),
          referenceId,
          transactionId: entry._id.toHexString(),
          type: TransactionType.Withdrawal,
        });
        await this.deps.outboxRepo.insert(
          { eventType: 'WITHDRAWAL_COMPLETED', payload: result.data },
          session,
        );
        await this.deps.idempotency.insert(
          { referenceId, type: TransactionType.Withdrawal, fingerprint, result },
          session,
        );
        return { result, wallets: [updated] };
      });
      await this.afterCommit(referenceId, fingerprint, committed.result, committed.wallets);
      this.deps.logger.info(
        { walletId: walletId.toHexString(), amount: formatAmount(amount), referenceId },
        'withdrawal committed',
      );
      return { ...committed.result, replayed: false };
    } catch (err) {
      // Duplicate referenceId means the debit already committed. Replay that result; do not debit again.
      if (isDuplicateKeyError(err)) return this.replayAfterConflict(referenceId, fingerprint);
      throw err;
    }
  }

  /**
   * Moves value between two wallets of the same asset in one transaction.
   * Both ledger legs share a transferId, so one side cannot commit without the other.
   */
  async transfer(
    fromWalletId: Types.ObjectId,
    toWalletId: Types.ObjectId,
    amountRaw: string,
    referenceId: string,
  ): Promise<MoneyOutcome> {
    // A wallet cannot pay itself; that would debit and credit the same balance in one movement.
    if (fromWalletId.equals(toWalletId)) {
      throw new SameWalletTransferError(fromWalletId.toHexString());
    }
    const amount = parseAmount(amountRaw);
    const loaded = await this.deps.walletRepo.findManyByIds([fromWalletId, toWalletId]);
    const from = loaded.find((wallet) => wallet._id.equals(fromWalletId));
    const to = loaded.find((wallet) => wallet._id.equals(toWalletId));
    if (!from) throw new WalletNotFoundError(fromWalletId.toHexString());
    if (!to) throw new WalletNotFoundError(toWalletId.toHexString());
    // Cross-asset transfers are rejected so a debit in one unit cannot be credited as another.
    if (from.asset !== to.asset) throw new AssetMismatchError(from.asset, to.asset);

    const fingerprint = this.deps.idempotency.fingerprint({
      type: 'TRANSFER',
      asset: from.asset,
      amount: formatAmount(amount),
      walletIds: [from._id.toHexString(), to._id.toHexString()],
    });
    const replay = await this.replayIfExists(referenceId, fingerprint);
    if (replay) return replay;

    try {
      // Both balances, both ledger legs, the outbox event, and the idempotency row commit or roll back together.
      const committed = await withMongoTransaction(async (session) => {
        const updated = await this.applyTransfer(fromWalletId, toWalletId, amount, session);
        // One id ties the debit and credit rows so history can show them as a single transfer.
        const transferId = new Types.ObjectId();
        const outEntry = await this.deps.transactionRepo.insert(
          {
            walletId: updated.from._id,
            userId: updated.from.userId,
            asset: updated.from.asset,
            type: TransactionType.TransferOut,
            direction: Direction.Debit,
            amount,
            balanceAfter: updated.from.balance,
            referenceId,
            counterpartyWalletId: updated.to._id,
            transferId,
          },
          session,
        );
        const inEntry = await this.deps.transactionRepo.insert(
          {
            walletId: updated.to._id,
            userId: updated.to.userId,
            asset: updated.to.asset,
            type: TransactionType.TransferIn,
            direction: Direction.Credit,
            amount,
            balanceAfter: updated.to.balance,
            referenceId,
            counterpartyWalletId: updated.from._id,
            transferId,
          },
          session,
        );
        const result = stored(200, {
          transferId: transferId.toHexString(),
          referenceId,
          asset: updated.from.asset,
          amount: formatAmount(amount),
          fromWalletId: updated.from._id.toHexString(),
          toWalletId: updated.to._id.toHexString(),
          fromBalance: formatAmount(updated.from.balance),
          toBalance: formatAmount(updated.to.balance),
          fromTransactionId: outEntry._id.toHexString(),
          toTransactionId: inEntry._id.toHexString(),
        });
        await this.deps.outboxRepo.insert(
          { eventType: 'TRANSFER_COMPLETED', payload: result.data },
          session,
        );
        await this.deps.idempotency.insert(
          { referenceId, type: 'TRANSFER', fingerprint, result },
          session,
        );
        return { result, wallets: [updated.from, updated.to] };
      });
      await this.afterCommit(referenceId, fingerprint, committed.result, committed.wallets);
      this.deps.logger.info(
        {
          fromWalletId: fromWalletId.toHexString(),
          toWalletId: toWalletId.toHexString(),
          amount: formatAmount(amount),
          referenceId,
        },
        'transfer committed',
      );
      return { ...committed.result, replayed: false };
    } catch (err) {
      // A concurrent transfer with this referenceId won. Replay it so neither wallet is touched twice.
      if (isDuplicateKeyError(err)) return this.replayAfterConflict(referenceId, fingerprint);
      throw err;
    }
  }

  /**
   * Debits and credits in wallet-id order. A fixed lock order stops two opposite
   * transfers from deadlocking, and the conditional debit still refuses a negative balance.
   */
  private async applyTransfer(
    fromWalletId: Types.ObjectId,
    toWalletId: Types.ObjectId,
    amount: MinorUnits,
    session: ClientSession,
  ): Promise<{ from: WalletDoc; to: WalletDoc }> {
    // Sort by id so from→to and to→from acquire the same wallet locks in the same order.
    const steps = [
      { id: fromWalletId, kind: 'debit' as const },
      { id: toWalletId, kind: 'credit' as const },
    ].sort((left, right) => (left.id.toHexString() < right.id.toHexString() ? -1 : 1));

    let from: WalletDoc | null = null;
    let to: WalletDoc | null = null;
    for (const step of steps) {
      if (step.kind === 'debit') {
        from = await this.deps.walletRepo.debitIfSufficient(fromWalletId, amount, session);
        if (!from) {
          // Same session as the debit: null is insufficient funds if the source still exists.
          const exists = await this.deps.walletRepo.exists(fromWalletId, session);
          throw exists
            ? new InsufficientFundsError(fromWalletId.toHexString())
            : new WalletNotFoundError(fromWalletId.toHexString());
        }
      } else {
        to = await this.deps.walletRepo.credit(toWalletId, amount, session);
        if (!to) throw new WalletNotFoundError(toWalletId.toHexString());
      }
    }
    if (!from || !to) throw new WalletNotFoundError(fromWalletId.toHexString());
    return { from, to };
  }

  /** Loads the wallet named by a movement. A miss fails before a transaction is opened. */
  private async requireWallet(walletId: Types.ObjectId): Promise<WalletDoc> {
    const wallet = await this.deps.walletRepo.findById(walletId);
    if (!wallet) throw new WalletNotFoundError(walletId.toHexString());
    return wallet;
  }

  /**
   * Returns the stored outcome when this referenceId already committed with the same payload.
   * A reused key with a different fingerprint is rejected so a new movement cannot ride an old result.
   */
  private async replayIfExists(referenceId: string, fingerprint: string): Promise<MoneyOutcome | null> {
    const existing = await this.deps.idempotency.find(referenceId);
    if (!existing) return null;
    if (existing.fingerprint !== fingerprint) throw new IdempotencyKeyReusedError(referenceId);
    return { ...existing.result, replayed: true };
  }

  /**
   * After a duplicate-key conflict, waits until the winning transaction stores its result.
   * Stops rather than applying the movement a second time.
   */
  private async replayAfterConflict(referenceId: string, fingerprint: string): Promise<MoneyOutcome> {
    for (let attempt = 0; attempt < REPLAY_ATTEMPTS; attempt += 1) {
      const existing = await this.replayIfExists(referenceId, fingerprint);
      if (existing) return existing;
      await delay(REPLAY_DELAY_MS);
    }
    throw new IdempotencyKeyReusedError(referenceId);
  }

  /**
   * Updates the balance and idempotency caches after commit. A failure is logged and ignored:
   * Mongo already holds the movement, and a stale cache must not turn that commit into an error.
   */
  private async afterCommit(
    referenceId: string,
    fingerprint: string,
    result: StoredResult,
    wallets: WalletDoc[],
  ): Promise<void> {
    try {
      await Promise.all(
        wallets.map((wallet) =>
          // Version gate: an older snapshot must not overwrite a balance committed later.
          this.deps.balanceCache.setIfNewer(wallet._id.toHexString(), {
            asset: wallet.asset,
            balance: wallet.balance,
            version: wallet.version,
          }),
        ),
      );
      await this.deps.idempotency.remember(referenceId, fingerprint, result);
    } catch (err) {
      this.deps.logger.warn({ err, referenceId }, 'post-commit cache update failed');
    }
  }
}

/** Shape stored with the idempotency row so a replay returns the original HTTP outcome. */
function stored(statusCode: number, data: Record<string, unknown>): StoredResult {
  return { statusCode, data };
}

/** Presents a new wallet at zero; the stored minor units stay off the wire. */
function presentWallet(wallet: WalletDoc): CreatedWallet {
  return {
    id: wallet._id.toHexString(),
    userId: wallet.userId,
    asset: wallet.asset,
    balance: formatAmount(wallet.balance),
    version: wallet.version,
    createdAt: wallet.createdAt.toISOString(),
  };
}

/** Pause between replay polls so the winning transaction can store its result. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
