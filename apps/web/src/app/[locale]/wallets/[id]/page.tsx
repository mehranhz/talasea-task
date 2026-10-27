import { WalletScreen } from "@/features/wallet/wallet-screen";

export default async function WalletPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WalletScreen key={id} />;
}
