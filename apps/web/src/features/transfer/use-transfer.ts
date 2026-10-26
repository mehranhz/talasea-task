"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, type TransferResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { fromWalletId: string; toWalletId: string; amount: string; referenceId: string }) =>
      apiRequest<TransferResult>("/api/v1/wallets/transfer", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async (_result, body) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.balance(body.fromWalletId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.balance(body.toWalletId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ledgerRoot(body.fromWalletId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ledgerRoot(body.toWalletId) }),
      ]);
    },
  });
}
