export const WALLETS_KEY = "talasea.wallets";

export type SavedWallet = {
  id: string;
  userId: string;
  asset: string;
};

function isSaved(value: unknown): value is SavedWallet {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.userId === "string" && typeof row.asset === "string";
}

function parseArray(raw: string): SavedWallet[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSaved);
  } catch {
    return null;
  }
}

function safeDecode(raw: string): string | null {
  try {
    const decoded = decodeURIComponent(raw);
    return decoded === raw ? null : decoded;
  } catch {
    return null;
  }
}

export function parseSavedWallets(raw: string | null | undefined): SavedWallet[] {
  if (!raw) return [];
  return parseArray(raw) ?? parseArray(safeDecode(raw) ?? "") ?? [];
}
