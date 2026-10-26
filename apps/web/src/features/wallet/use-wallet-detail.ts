"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, type Balance, type LedgerRow, type Movement } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type HistoryType = "" | LedgerRow["type"];

async function ledgerPage(id: string, filter: HistoryType, cursor: string | null) {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);
  if (filter) query.set("type", filter);
  return apiRequest<LedgerRow[]>(`/api/v1/wallets/${id}/transactions?${query.toString()}`);
}

export function useWalletDetail(id: string, filter: HistoryType, enabled: boolean) {
  const queryClient = useQueryClient();
  const balance = useQuery({
    queryKey: queryKeys.balance(id),
    enabled,
    queryFn: () => apiRequest<Balance>(`/api/v1/wallets/${id}/balance`),
  });
  const history = useInfiniteQuery({
    queryKey: queryKeys.ledger(id, filter),
    enabled,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => ledgerPage(id, filter, pageParam),
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });
  const move = useMutation({
    mutationFn: (body: { mode: "deposit" | "withdraw"; amount: string; referenceId: string }) =>
      apiRequest<Movement>(`/api/v1/wallets/${id}/${body.mode}`, {
        method: "POST",
        body: JSON.stringify({ amount: body.amount, referenceId: body.referenceId }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.balance(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ledgerRoot(id) }),
      ]);
    },
  });

  const rows = history.data?.pages.flatMap((page) => page.data) ?? [];

  return { balance, history, rows, move };
}
