import { setRequestLocale } from "next-intl/server";
import { WalletsScreen } from "@/features/wallets/wallets-screen";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WalletsScreen />;
}
