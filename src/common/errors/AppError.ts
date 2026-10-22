export const ErrorCode = {
  Validation: 'VALIDATION_ERROR',
  WalletNotFound: 'WALLET_NOT_FOUND',
  WalletExists: 'WALLET_EXISTS',
  InsufficientFunds: 'INSUFFICIENT_FUNDS',
  SameWalletTransfer: 'SAME_WALLET_TRANSFER',
  AssetMismatch: 'ASSET_MISMATCH',
  IdempotencyKeyReused: 'IDEMPOTENCY_KEY_REUSED',
  RateLimited: 'RATE_LIMITED',
  ServiceUnavailable: 'SERVICE_UNAVAILABLE',
  Internal: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  WALLET_NOT_FOUND: 404,
  WALLET_EXISTS: 409,
  INSUFFICIENT_FUNDS: 422,
  SAME_WALLET_TRANSFER: 422,
  ASSET_MISMATCH: 422,
  IDEMPOTENCY_KEY_REUSED: 409,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
    this.details = details;
  }
}
