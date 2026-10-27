"use client";

import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useLayoutEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { apiRequest, isWalletMissing, type CreatedWallet } from "@/lib/api";
import { useDescribeError } from "@/lib/errors";
import { formatMinor, WALLET_ID } from "@/lib/money";
import { queryKeys } from "@/lib/query-keys";
import { forgetWallet, forgetWallets, readWallets, rememberWallet, useSavedWallets, type SavedWallet } from "@/lib/wallets";
import { fetchBalance } from "@/lib/wallet-reads";

const ASSETS = ["USD", "EUR"] as const;
export type WalletAsset = (typeof ASSETS)[number];
export { ASSETS };

export type WalletBalanceRead =
  | { status: "pending" }
  | { status: "error"; message: string }
  | { status: "ready"; text: string };

export function useWalletDirectory(initialWallets: SavedWallet[] = [], missingWalletIds: readonly string[] = []) {
  const locale = useLocale();
  const errors = useTranslations("errors");
  const describeError = useDescribeError();
  const router = useRouter();
  const pathname = usePathname();
  const saved = useSavedWallets(initialWallets, missingWalletIds);
  const queryClient = useQueryClient();
  const balances = useQueries({
    queries: saved.map((wallet) => ({
      queryKey: queryKeys.balance(wallet.id),
      queryFn: () => fetchBalance(wallet.id),
    })),
  });
  const missingNow = saved.filter((wallet, index) => {
    const query = balances[index];
    return query?.isError === true && isWalletMissing(query.error);
  });
  const missingNowKey = missingNow.map((wallet) => wallet.id).join("\n");
  const wallets = missingNowKey ? saved.filter((wallet) => !missingNowKey.split("\n").includes(wallet.id)) : saved;

  useLayoutEffect(() => {
    if (!missingNowKey) return;
    forgetWallets(missingNowKey.split("\n"));
  }, [missingNowKey]);

  const create = useMutation({
    mutationFn: (body: { userId: string; asset: string }) =>
      apiRequest<CreatedWallet>("/api/v1/wallets", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (result) => {
      rememberWallet({
        id: result.data.id,
        userId: result.data.userId,
        asset: result.data.asset,
      });
      queryClient.setQueryData(queryKeys.balance(result.data.id), {
        data: {
          walletId: result.data.id,
          asset: result.data.asset,
          balance: result.data.balance,
          version: result.data.version,
        },
        meta: result.meta,
        replayed: result.replayed,
      });
    },
  });

  const open = useMutation({
    mutationFn: (id: string) => fetchBalance(id),
    onSuccess: (result, id) => {
      const existing = readWallets().find((wallet) => wallet.id === id);
      rememberWallet({
        id,
        userId: existing?.userId ?? "",
        asset: result.data.asset,
      });
      queryClient.setQueryData(queryKeys.balance(id), result);
    },
  });

  const [userId, setUserIdState] = useState("");
  const [asset, setAssetState] = useState<WalletAsset>("USD");
  const [openId, setOpenIdState] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [seenPath, setSeenPath] = useState(pathname);
  const [homeReset, setHomeReset] = useState(false);

  function clearEntry() {
    setHomeReset(false);
    setUserIdState("");
    setAssetState("USD");
    setOpenIdState("");
    setCreateError(null);
    setOpenError(null);
  }

  const entryPending = create.isPending || open.isPending;
  const pathChanged = seenPath !== pathname;
  const showHomeAgain = pathChanged && pathname === "/";
  if (pathChanged) setSeenPath(pathname);
  if ((showHomeAgain || homeReset) && pathname === "/" && !entryPending) {
    clearEntry();
  } else if (showHomeAgain && entryPending) {
    setHomeReset(true);
  }

  function setUserId(value: string) {
    setUserIdState(value);
    setHomeReset(false);
  }

  function setAsset(value: WalletAsset) {
    setAssetState(value);
    setHomeReset(false);
  }

  function setOpenId(value: string) {
    setOpenIdState(value);
    setHomeReset(false);
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    if (!userId.trim()) {
      setCreateError(errors("required"));
      return;
    }
    try {
      const result = await create.mutateAsync({ userId: userId.trim(), asset });
      clearEntry();
      router.push(`/wallets/${result.data.id}`);
    } catch (error) {
      setCreateError(describeError(error));
    }
  }

  async function onOpen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOpenError(null);
    const id = openId.trim();
    if (!WALLET_ID.test(id)) {
      setOpenError(errors("walletId"));
      return;
    }
    try {
      await open.mutateAsync(id);
      clearEntry();
      router.push(`/wallets/${id}`);
    } catch (error) {
      if (isWalletMissing(error)) forgetWallet(id);
      setOpenError(describeError(error));
    }
  }

  function balanceFor(id: string): WalletBalanceRead {
    const index = saved.findIndex((wallet) => wallet.id === id);
    const query = balances[index];
    if (!query || query.isPending) return { status: "pending" };
    if (query.isError || !query.data) {
      return { status: "error", message: query.isError ? describeError(query.error) : errors("unknown") };
    }
    return { status: "ready", text: formatMinor(query.data.data.balance, query.data.data.asset, locale) };
  }

  return {
    wallets,
    balanceFor,
    createPending: create.isPending,
    openPending: open.isPending,
    userId,
    asset,
    openId,
    createError,
    openError,
    setUserId,
    setAsset,
    setOpenId,
    onCreate,
    onOpen,
  };
}
