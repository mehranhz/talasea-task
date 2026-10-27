"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { parseSavedWallets, WALLETS_KEY, type SavedWallet } from "./saved-wallets";

export type { SavedWallet };

const emptyWallets: SavedWallet[] = [];
const cookieMaxAge = 60 * 60 * 24 * 365;
const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedWallets: SavedWallet[] = emptyWallets;

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function storeSnapshot(raw: string | null, wallets: SavedWallet[]): SavedWallet[] {
  cachedRaw = raw;
  cachedWallets = wallets;
  return wallets;
}

export function writeWalletsCookie(raw: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${WALLETS_KEY}=${encodeURIComponent(raw)}; Path=/; Max-Age=${cookieMaxAge}; SameSite=Lax`;
}

export function mirrorWalletsCookie(): void {
  if (typeof window === "undefined") return;
  try {
    writeWalletsCookie(localStorage.getItem(WALLETS_KEY) ?? "[]");
  } catch {
    // Private mode can reject storage reads.
  }
}

export function readWallets(): SavedWallet[] {
  if (typeof window === "undefined") return emptyWallets;
  let raw: string | null;
  try {
    raw = localStorage.getItem(WALLETS_KEY);
  } catch {
    return storeSnapshot(null, emptyWallets);
  }
  if (raw === cachedRaw) return cachedWallets;
  const wallets = parseSavedWallets(raw);
  return storeSnapshot(raw, wallets.length === 0 ? emptyWallets : wallets);
}

export function rememberWallet(wallet: SavedWallet): SavedWallet[] {
  const next = [wallet, ...readWallets().filter((item) => item.id !== wallet.id)];
  const raw = JSON.stringify(next);
  if (raw === cachedRaw) return cachedWallets;
  localStorage.setItem(WALLETS_KEY, raw);
  writeWalletsCookie(raw);
  cachedRaw = raw;
  cachedWallets = next;
  emit();
  return next;
}

function cookieEntry(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${WALLETS_KEY}=`;
  const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : null;
}

function scrubCookie(drop: ReadonlySet<string>): void {
  const entry = cookieEntry();
  if (!entry) return;
  const parsed = parseSavedWallets(entry);
  if (!parsed.some((wallet) => drop.has(wallet.id))) return;
  writeWalletsCookie(JSON.stringify(parsed.filter((wallet) => !drop.has(wallet.id))));
}

export function forgetWallets(ids: readonly string[], options?: { notify?: boolean }): SavedWallet[] {
  const drop = new Set(ids.filter((id) => id.length > 0));
  const current = readWallets();
  if (drop.size === 0) return current;
  const next = current.filter((wallet) => !drop.has(wallet.id));
  if (next.length !== current.length) {
    const raw = JSON.stringify(next);
    localStorage.setItem(WALLETS_KEY, raw);
    writeWalletsCookie(raw);
    cachedRaw = raw;
    cachedWallets = next.length === 0 ? emptyWallets : next;
    if (options?.notify !== false) emit();
    return cachedWallets;
  }
  scrubCookie(drop);
  return current;
}

export function forgetWallet(id: string, options?: { notify?: boolean }): SavedWallet[] {
  return forgetWallets([id], options);
}

export function useSavedWallets(
  serverWallets: SavedWallet[] = emptyWallets,
  missingIds: readonly string[] = [],
): SavedWallet[] {
  const raw = JSON.stringify(serverWallets);
  const missingKey = missingIds.filter((id) => id.length > 0).join("\n");
  const snapshot = useMemo(() => {
    const wallets = parseSavedWallets(raw);
    return wallets.length === 0 ? emptyWallets : wallets;
  }, [raw]);
  // The server already omitted these ids. Drop them before the client snapshot is read,
  // or hydration will paint the localStorage copy back onto the list.
  if (typeof window !== "undefined" && missingKey) {
    forgetWallets(missingKey.split("\n"), { notify: false });
  }
  useEffect(() => {
    if (!missingKey) return;
    emit();
  }, [missingKey]);
  useEffect(() => {
    mirrorWalletsCookie();
  }, []);
  return useSyncExternalStore(subscribe, readWallets, () => snapshot);
}
