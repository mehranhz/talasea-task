export const queryKeys = {
  health: ["health"] as const,
  balance: (id: string) => ["wallets", id, "balance"] as const,
  ledger: (id: string, filter: string) => ["wallets", id, "ledger", filter] as const,
  ledgerRoot: (id: string) => ["wallets", id, "ledger"] as const,
};
