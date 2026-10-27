"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { usePathname } from "@/i18n/navigation";
import { apiRequest, type Balance, type LedgerRow, type Movement } from "@/lib/api";
import { useDescribeError } from "@/lib/errors";
import { newReferenceId, toMinorUnits, WALLET_ID } from "@/lib/money";
import { queryKeys } from "@/lib/query-keys";
import { useReferenceId } from "@/lib/reference";

export type HistoryType = "" | LedgerRow["type"];
export type MovementMode = "deposit" | "withdraw";

async function ledgerPage(id: string, filter: HistoryType, cursor: string | null) {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);
  if (filter) query.set("type", filter);
  return apiRequest<LedgerRow[]>(`/api/v1/wallets/${id}/transactions?${query.toString()}`);
}

export function useWalletDetail(id: string) {
  const pathname = usePathname();
  const errors = useTranslations("errors");
  const describeError = useDescribeError();
  const queryClient = useQueryClient();
  const valid = WALLET_ID.test(id);
  const [mode, setModeState] = useState<MovementMode>("deposit");
  const [amount, setAmountState] = useState("");
  const [referenceId, setReferenceId] = useReferenceId();
  const [filter, setFilter] = useState<HistoryType>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [replayed, setReplayed] = useState(false);
  const routeKey = `${pathname}:${id}`;
  const [seenRoute, setSeenRoute] = useState(routeKey);
  const routeChanged = seenRoute !== routeKey;
  if (routeChanged) {
    setSeenRoute(routeKey);
    setModeState("deposit");
    setAmountState("");
    setReferenceId(newReferenceId());
    setFilter("");
    setFormError(null);
    setReplayed(false);
  }

  const balance = useQuery({
    queryKey: queryKeys.balance(id),
    enabled: valid,
    queryFn: () => apiRequest<Balance>(`/api/v1/wallets/${id}/balance`),
  });
  const history = useInfiniteQuery({
    queryKey: queryKeys.ledger(id, routeChanged ? "" : filter),
    enabled: valid,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => ledgerPage(id, routeChanged ? "" : filter, pageParam),
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });
  const move = useMutation({
    mutationFn: (body: { mode: MovementMode; amount: string; referenceId: string }) =>
      apiRequest<Movement>(`/api/v1/wallets/${id}/${body.mode}`, {
        method: "POST",
        body: JSON.stringify({ amount: body.amount, referenceId: body.referenceId }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.balance(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ledgerRoot(id) }),
      ]);
    },
  });

  const rows = history.data?.pages.flatMap((page) => page.data) ?? [];
  const activeMode = routeChanged ? "deposit" : mode;
  const activeAmount = routeChanged ? "" : amount;
  const activeFilter = routeChanged ? "" : filter;
  const activeError = routeChanged ? null : formError;
  const activeReplayed = routeChanged ? false : replayed;

  function setMode(next: MovementMode) {
    setModeState(next);
    setFormError(null);
  }

  function setAmount(value: string) {
    setAmountState(value);
    setFormError(null);
  }

  function rotateReference() {
    setReferenceId(newReferenceId());
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!balance.data?.data) return;
    setFormError(null);
    setReplayed(false);
    if (!referenceId.trim()) {
      setFormError(errors("required"));
      return;
    }
    let minor: string;
    try {
      minor = toMinorUnits(activeAmount);
    } catch (error) {
      setFormError(describeError(error));
      return;
    }
    try {
      const result = await move.mutateAsync({ mode: activeMode, amount: minor, referenceId });
      setAmountState("");
      setFormError(null);
      setReferenceId(newReferenceId());
      setReplayed(result.replayed);
    } catch (error) {
      setFormError(describeError(error));
    }
  }

  return {
    valid,
    balance,
    history,
    rows,
    mode: activeMode,
    amount: activeAmount,
    referenceId,
    filter: activeFilter,
    formError: activeError,
    replayed: activeReplayed,
    movePending: move.isPending,
    setMode,
    setAmount,
    setReferenceId,
    setFilter,
    rotateReference,
    onSubmit,
  };
}
