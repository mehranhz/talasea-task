import {
  ErrorCode,
  HTTP_STATUS,
  type ApiMeta,
  type Balance,
  type CreatedWallet,
  type LedgerRow,
  type Movement,
  type TransferResult,
} from "@talasea/types";

export type { ApiMeta, Balance, CreatedWallet, LedgerRow, Movement, TransferResult };

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

type Meta = ApiMeta;

function apiOrigin(): string {
  const published = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  if (typeof window === "undefined" && process.env.API_URL) return process.env.API_URL;
  return published;
}

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
    response = await fetch(`${apiOrigin()}${path}`, { ...init, headers, cache: "no-store" });
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

/** GET /wallets/:id/balance answers a missing wallet with 404 WALLET_NOT_FOUND. */
export function isWalletMissing(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === HTTP_STATUS[ErrorCode.WalletNotFound] &&
    error.code === ErrorCode.WalletNotFound
  );
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    const request = error.requestId ? ` Request ${error.requestId}.` : "";
    return `${error.message}${request}`;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
