export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | null;

  constructor(status: number, code: string, message: string, details: unknown, requestId: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

export type CreatedWallet = {
  id: string;
  userId: string;
  asset: string;
  balance: string;
  version: number;
  createdAt: string;
};

export type Balance = {
  walletId: string;
  asset: string;
  balance: string;
  version: number;
};

export type Movement = {
  walletId: string;
  asset: string;
  amount: string;
  balance: string;
  referenceId: string;
  transactionId: string;
  type: string;
};

export type TransferResult = {
  transferId: string;
  referenceId: string;
  asset: string;
  amount: string;
  fromWalletId: string;
  toWalletId: string;
  fromBalance: string;
  toBalance: string;
  fromTransactionId: string;
  toTransactionId: string;
};

export type LedgerRow = {
  id: string;
  walletId: string;
  userId: string;
  asset: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER_OUT" | "TRANSFER_IN";
  direction: "CREDIT" | "DEBIT";
  amount: string;
  balanceAfter: string;
  referenceId: string;
  counterpartyWalletId: string | null;
  transferId: string | null;
  createdAt: string;
};

type Meta = {
  requestId?: string;
  nextCursor?: string | null;
  limit?: number;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; meta: Meta; replayed: boolean }> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "NETWORK", "NETWORK", {}, null);
  }

  const body: unknown = await response.json().catch(() => null);
  const record = isRecord(body) ? body : {};
  const meta = isRecord(record.meta) ? record.meta : {};
  if (!response.ok) {
    const error = isRecord(record.error) ? record.error : {};
    throw new ApiError(
      response.status,
      typeof error.code === "string" ? error.code : "REQUEST_FAILED",
      typeof error.message === "string" ? error.message : "REQUEST_FAILED",
      error.details ?? {},
      typeof meta.requestId === "string" ? meta.requestId : null,
    );
  }

  return {
    data: record.data as T,
    meta: {
      requestId: typeof meta.requestId === "string" ? meta.requestId : undefined,
      nextCursor: typeof meta.nextCursor === "string" || meta.nextCursor === null ? meta.nextCursor : undefined,
      limit: typeof meta.limit === "number" ? meta.limit : undefined,
    },
    replayed: response.headers.get("Idempotency-Replayed") === "true",
  };
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    const request = error.requestId ? ` Request ${error.requestId}.` : "";
    return `${error.message}${request}`;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
