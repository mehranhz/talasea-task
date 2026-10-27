import { AppError, ErrorCode } from './AppError';

export class ValidationError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(ErrorCode.Validation, message, details);
  }
}

export class WalletNotFoundError extends AppError {
  constructor(walletId: string) {
    super(ErrorCode.WalletNotFound, 'Wallet not found', { walletId });
  }
}

export class WalletExistsError extends AppError {
  constructor(userId: string, asset: string) {
    super(ErrorCode.WalletExists, 'Wallet already exists for this user and asset', { userId, asset });
  }
}

export class InsufficientFundsError extends AppError {
  constructor(walletId: string) {
    super(ErrorCode.InsufficientFunds, 'Insufficient funds', { walletId });
  }
}

export class SameWalletTransferError extends AppError {
  constructor(walletId: string) {
    super(ErrorCode.SameWalletTransfer, 'Cannot transfer to the same wallet', { walletId });
  }
}

export class AssetMismatchError extends AppError {
  constructor(fromAsset: string, toAsset: string) {
    super(ErrorCode.AssetMismatch, 'Wallet assets do not match', { fromAsset, toAsset });
  }
}

export class IdempotencyKeyReusedError extends AppError {
  constructor(referenceId: string) {
    super(ErrorCode.IdempotencyKeyReused, 'referenceId was reused with a different request', {
      referenceId,
    });
  }
}

export class RateLimitedError extends AppError {
  constructor() {
    super(ErrorCode.RateLimited, 'Too many requests');
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string) {
    super(ErrorCode.ServiceUnavailable, message);
  }
}

export interface DuplicateKeyInfo {
  code: number;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
}

export function isDuplicateKeyError(err: unknown): err is DuplicateKeyInfo {
  if (typeof err !== 'object' || err === null) return false;
  const candidate = err as { code?: unknown; codeName?: unknown };
  return candidate.code === 11000 || candidate.codeName === 'DuplicateKey';
}
