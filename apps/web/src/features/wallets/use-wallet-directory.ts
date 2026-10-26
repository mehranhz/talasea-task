"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, type Balance, type CreatedWallet } from "@/lib/api";
import { formatMinor } from "@/lib/money";
import { queryKeys } from "@/lib/query-keys";
import { readWallets, rememberWallet, useSavedWallets } from "@/lib/wallets";

const ASSETS = ["USD", "EUR"] as const;
export type WalletAsset = (typeof ASSETS)[number];
export { ASSETS };

export function useWalletDirectory() {
  const locale = useLocale();
  const t = useTranslations("wallets");
  const wallets = useSavedWallets();
  const queryClient = useQueryClient();
  const health = useQuery({
    queryKey: queryKeys.health,
    retry: false,
    queryFn: () => apiRequest<{ status: string }>("/health/live"),
  });
  const balances = useQueries({
    queries: wallets.map((wallet) => ({
      queryKey: queryKeys.balance(wallet.id),
      queryFn: () => apiRequest<Balance>(`/api/v1/wallets/${wallet.id}/balance`),
    })),
  });

  const create = useMutation({
    mutationFn: (body: { userId: string; asset: string }) =>
      apiRequest<CreatedWallet>("/api/v1/wallets", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (result) => {
      rememberWallet({
        id: result.data.id,
        userId: result.data.userId,
        asset: result.data.asset,
      });
      queryClient.setQueryData(queryKeys.balance(result.data.id), {
        data: {
          walletId: result.data.id,
          asset: result.data.asset,
          balance: result.data.balance,
          version: result.data.version,
        },
        meta: result.meta,
        replayed: result.replayed,
      });
    },
  });

  const open = useMutation({
    mutationFn: (id: string) => apiRequest<Balance>(`/api/v1/wallets/${id}/balance`),
    onSuccess: (result, id) => {
      const existing = readWallets().find((wallet) => wallet.id === id);
      rememberWallet({
        id,
        userId: existing?.userId ?? "",
        asset: result.data.asset,
      });
      queryClient.setQueryData(queryKeys.balance(id), result);
    },
  });

  function balanceText(id: string): string | undefined {
    const index = wallets.findIndex((wallet) => wallet.id === id);
    const query = balances[index];
    if (!query || query.isPending) return undefined;
    if (query.isError || !query.data) return t("unavailable");
    return formatMinor(query.data.data.balance, query.data.data.asset, locale);
  }

  const status = health.isPending ? "checking" : health.isError ? "offline" : "online";

  return { wallets, status, balanceText, create, open };
}
