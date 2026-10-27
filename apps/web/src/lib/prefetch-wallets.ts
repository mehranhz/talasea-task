import { QueryClient } from "@tanstack/react-query";
import { isWalletMissing } from "./api";
import { WALLET_ID } from "./money";
import { queryKeys } from "./query-keys";
import type { SavedWallet } from "./saved-wallets";
import { fetchBalance, fetchLedgerPage } from "./wallet-reads";

export function createRequestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 5_000,
      },
    },
  });
}

export async function prefetchBalances(
  client: QueryClient,
  wallets: SavedWallet[],
): Promise<{ wallets: SavedWallet[]; missingIds: string[] }> {
  const readable = wallets.filter((wallet) => WALLET_ID.test(wallet.id));
  await Promise.all(
    readable.map((wallet) =>
      client.prefetchQuery({
        queryKey: queryKeys.balance(wallet.id),
        queryFn: () => fetchBalance(wallet.id),
      }),
    ),
  );
  const missingIds = readable
    .filter((wallet) => isWalletMissing(client.getQueryState(queryKeys.balance(wallet.id))?.error))
    .map((wallet) => wallet.id);
  if (missingIds.length === 0) return { wallets, missingIds };
  const missing = new Set(missingIds);
  return { wallets: wallets.filter((wallet) => !missing.has(wallet.id)), missingIds };
}

export async function prefetchWalletReads(client: QueryClient, id: string): Promise<{ missing: boolean }> {
  await Promise.all([
    client.prefetchQuery({
      queryKey: queryKeys.balance(id),
      queryFn: () => fetchBalance(id),
    }),
    client.prefetchInfiniteQuery({
      queryKey: queryKeys.ledger(id, ""),
      initialPageParam: null as string | null,
      queryFn: ({ pageParam }) => fetchLedgerPage(id, "", pageParam),
    }),
  ]);
  return { missing: isWalletMissing(client.getQueryState(queryKeys.balance(id))?.error) };
}
