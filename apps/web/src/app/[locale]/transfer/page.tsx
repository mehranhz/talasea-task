import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TransferScreen } from "@/features/transfer/transfer-screen";
import { routing } from "@/i18n/routing";
import { readSavedWallets } from "@/lib/read-saved-wallets";
import Loading from "../loading";

export default async function TransferPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Loading />}>
      <TransferContent />
    </Suspense>
  );
}

async function TransferContent() {
  const wallets = await readSavedWallets();
  return <TransferScreen initialWallets={wallets} />;
}
