import { apiRequest, WALLETS_API_PATH, type Balance, type LedgerRow } from "./api";

export const LEDGER_PAGE_SIZE = 20;

export function fetchBalance(id: string) {
  return apiRequest<Balance>(`${WALLETS_API_PATH}/${id}/balance`);
}

export function fetchLedgerPage(id: string, filter: string, cursor: string | null) {
  const query = new URLSearchParams({ limit: String(LEDGER_PAGE_SIZE) });
  if (cursor) query.set("cursor", cursor);
  if (filter) query.set("type", filter);
  return apiRequest<LedgerRow[]>(`${WALLETS_API_PATH}/${id}/transactions?${query.toString()}`);
}
