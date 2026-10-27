import { apiRequest, type Balance, type LedgerRow } from "./api";

export function fetchBalance(id: string) {
  return apiRequest<Balance>(`/api/v1/wallets/${id}/balance`);
}

export function fetchLedgerPage(id: string, filter: string, cursor: string | null) {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);
  if (filter) query.set("type", filter);
  return apiRequest<LedgerRow[]>(`/api/v1/wallets/${id}/transactions?${query.toString()}`);
}
