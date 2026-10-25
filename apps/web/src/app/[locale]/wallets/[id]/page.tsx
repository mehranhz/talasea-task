import { setRequestLocale } from "next-intl/server";
import { WalletScreen } from "@/features/wallet/wallet-screen";

export default async function WalletPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WalletScreen />;
}
