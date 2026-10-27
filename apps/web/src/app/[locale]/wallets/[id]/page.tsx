import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { WalletScreen } from "@/features/wallet/wallet-screen";
import { WALLET_ID } from "@/lib/money";
import { createRequestQueryClient, prefetchWalletReads } from "@/lib/prefetch-wallets";
import { readSavedWallets } from "@/lib/read-saved-wallets";
import Loading from "../../loading";

export default function WalletPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <WalletContent params={params} />
    </Suspense>
  );
}

async function WalletContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!WALLET_ID.test(id)) return <WalletScreen key={id} />;

  const client = createRequestQueryClient();
  const [{ missing }, wallets] = await Promise.all([prefetchWalletReads(client, id), readSavedWallets()]);
  const missingWalletIds = missing ? [id] : [];
  const initialWallets = missing ? wallets.filter((wallet) => wallet.id !== id) : wallets;
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <WalletScreen key={id} initialWallets={initialWallets} missingWalletIds={missingWalletIds} />
    </HydrationBoundary>
  );
}
