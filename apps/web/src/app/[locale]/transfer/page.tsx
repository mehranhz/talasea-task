import { setRequestLocale } from "next-intl/server";
import { TransferScreen } from "@/features/transfer/transfer-screen";

export default async function TransferPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TransferScreen />;
}
