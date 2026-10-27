import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WalletsScreen } from "@/features/wallets/wallets-screen";
import { routing } from "@/i18n/routing";
import { createRequestQueryClient, prefetchBalances } from "@/lib/prefetch-wallets";
import { readSavedWallets } from "@/lib/read-saved-wallets";
import Loading from "./loading";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Loading />}>
      <HomeContent locale={locale} />
    </Suspense>
  );
}

async function HomeContent({ locale }: { locale: string }) {
  const saved = await readSavedWallets();
  const client = createRequestQueryClient();
  const { wallets, missingIds } = await prefetchBalances(client, saved);
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <WalletsScreen key={locale} initialWallets={wallets} missingWalletIds={missingIds} />
    </HydrationBoundary>
  );
}
