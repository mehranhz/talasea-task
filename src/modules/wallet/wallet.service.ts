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
      if (isDuplicateKeyError(err)) return this.replayAfterConflict(referenceId, fingerprint);
      throw err;
    }
  }

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
      const committed = await withMongoTransaction(async (session) => {
        const updated = await this.deps.walletRepo.debitIfSufficient(walletId, amount, session);
        if (!updated) {
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
      if (isDuplicateKeyError(err)) return this.replayAfterConflict(referenceId, fingerprint);
      throw err;
    }
  }

  async transfer(
    fromWalletId: Types.ObjectId,
    toWalletId: Types.ObjectId,
    amountRaw: string,
    referenceId: string,
  ): Promise<MoneyOutcome> {
    if (fromWalletId.equals(toWalletId)) {
      throw new SameWalletTransferError(fromWalletId.toHexString());
    }
    const amount = parseAmount(amountRaw);
    const loaded = await this.deps.walletRepo.findManyByIds([fromWalletId, toWalletId]);
    const from = loaded.find((wallet) => wallet._id.equals(fromWalletId));
    const to = loaded.find((wallet) => wallet._id.equals(toWalletId));
    if (!from) throw new WalletNotFoundError(fromWalletId.toHexString());
    if (!to) throw new WalletNotFoundError(toWalletId.toHexString());
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
      const committed = await withMongoTransaction(async (session) => {
        const updated = await this.applyTransfer(fromWalletId, toWalletId, amount, session);
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
      if (isDuplicateKeyError(err)) return this.replayAfterConflict(referenceId, fingerprint);
      throw err;
    }
  }

  private async applyTransfer(
    fromWalletId: Types.ObjectId,
    toWalletId: Types.ObjectId,
    amount: MinorUnits,
    session: ClientSession,
  ): Promise<{ from: WalletDoc; to: WalletDoc }> {
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

  private async requireWallet(walletId: Types.ObjectId): Promise<WalletDoc> {
    const wallet = await this.deps.walletRepo.findById(walletId);
    if (!wallet) throw new WalletNotFoundError(walletId.toHexString());
    return wallet;
  }

  private async replayIfExists(referenceId: string, fingerprint: string): Promise<MoneyOutcome | null> {
    const existing = await this.deps.idempotency.find(referenceId);
    if (!existing) return null;
    if (existing.fingerprint !== fingerprint) throw new IdempotencyKeyReusedError(referenceId);
    return { ...existing.result, replayed: true };
  }

  private async replayAfterConflict(referenceId: string, fingerprint: string): Promise<MoneyOutcome> {
    for (let attempt = 0; attempt < REPLAY_ATTEMPTS; attempt += 1) {
      const existing = await this.replayIfExists(referenceId, fingerprint);
      if (existing) return existing;
      await delay(REPLAY_DELAY_MS);
    }
    throw new IdempotencyKeyReusedError(referenceId);
  }

  private async afterCommit(
    referenceId: string,
    fingerprint: string,
    result: StoredResult,
    wallets: WalletDoc[],
  ): Promise<void> {
    try {
      await Promise.all(
        wallets.map((wallet) =>
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

function stored(statusCode: number, data: Record<string, unknown>): StoredResult {
  return { statusCode, data };
}

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
