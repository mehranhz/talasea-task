"use client";

import { useSyncExternalStore } from "react";

export type SavedWallet = {
  id: string;
  userId: string;
  asset: string;
};

const KEY = "talasea.wallets";
const emptyWallets: SavedWallet[] = [];
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

function getServerSnapshot(): SavedWallet[] {
  return emptyWallets;
}

function isSaved(value: unknown): value is SavedWallet {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.userId === "string" && typeof row.asset === "string";
}

function storeSnapshot(raw: string | null, wallets: SavedWallet[]): SavedWallet[] {
  cachedRaw = raw;
  cachedWallets = wallets;
  return wallets;
}

export function readWallets(): SavedWallet[] {
  if (typeof window === "undefined") return emptyWallets;
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return storeSnapshot(null, emptyWallets);
  }
  if (raw === cachedRaw) return cachedWallets;
  if (raw === null) return storeSnapshot(null, emptyWallets);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return storeSnapshot(raw, emptyWallets);
    const wallets = parsed.filter(isSaved);
    return storeSnapshot(raw, wallets.length === 0 ? emptyWallets : wallets);
  } catch {
    return storeSnapshot(raw, emptyWallets);
  }
}

export function rememberWallet(wallet: SavedWallet): SavedWallet[] {
  const next = [wallet, ...readWallets().filter((item) => item.id !== wallet.id)];
  const raw = JSON.stringify(next);
  if (raw === cachedRaw) return cachedWallets;
  localStorage.setItem(KEY, raw);
  cachedRaw = raw;
  cachedWallets = next;
  emit();
  return next;
}

export function useSavedWallets(): SavedWallet[] {
  return useSyncExternalStore(subscribe, readWallets, getServerSnapshot);
}
