import { cookies } from "next/headers";
import { parseSavedWallets, WALLETS_KEY, type SavedWallet } from "./saved-wallets";

export async function readSavedWallets(): Promise<SavedWallet[]> {
  const jar = await cookies();
  return parseSavedWallets(jar.get(WALLETS_KEY)?.value);
}
