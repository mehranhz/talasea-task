"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { usePathname } from "@/i18n/navigation";
import { apiRequest, type TransferResult } from "@/lib/api";
import { useDescribeError } from "@/lib/errors";
import { newReferenceId, toMinorUnits, WALLET_ID } from "@/lib/money";
import { queryKeys } from "@/lib/query-keys";
import { useReferenceId } from "@/lib/reference";

export function useTransfer() {
  const pathname = usePathname();
  const errors = useTranslations("errors");
  const describeError = useDescribeError();
  const queryClient = useQueryClient();
  const transfer = useMutation({
    mutationFn: (body: { fromWalletId: string; toWalletId: string; amount: string; referenceId: string }) =>
      apiRequest<TransferResult>("/api/v1/wallets/transfer", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async (_result, body) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.balance(body.fromWalletId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.balance(body.toWalletId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ledgerRoot(body.fromWalletId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ledgerRoot(body.toWalletId) }),
      ]);
    },
  });
  const [fromWalletId, setFromWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [amount, setAmountState] = useState("");
  const [referenceId, setReferenceId] = useReferenceId();
  const [error, setError] = useState<string | null>(null);
  const [replayed, setReplayed] = useState(false);
  const [result, setResult] = useState<TransferResult | null>(null);
  const [seenPath, setSeenPath] = useState(pathname);
  const pathChanged = seenPath !== pathname;
  if (pathChanged) {
    setSeenPath(pathname);
    setFromWalletId("");
    setToWalletId("");
    setAmountState("");
    setError(null);
    setReferenceId(newReferenceId());
    setReplayed(false);
    setResult(null);
  }

  const activeAmount = pathChanged ? "" : amount;
  const activeFrom = pathChanged ? "" : fromWalletId;
  const activeTo = pathChanged ? "" : toWalletId;
  const activeError = pathChanged ? null : error;
  const activeReplayed = pathChanged ? false : replayed;
  const activeResult = pathChanged ? null : result;

  function setAmount(value: string) {
    setAmountState(value);
    setError(null);
  }

  function setFrom(value: string) {
    setFromWalletId(value);
    setError(null);
  }

  function setTo(value: string) {
    setToWalletId(value);
    setError(null);
  }

  function rotateReference() {
    setReferenceId(newReferenceId());
  }

  function clearPayload() {
    setFromWalletId("");
    setToWalletId("");
    setAmountState("");
    setError(null);
    setReferenceId(newReferenceId());
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setReplayed(false);
    setResult(null);
    if (!referenceId.trim()) {
      setError(errors("required"));
      return;
    }
    const from = activeFrom.trim();
    const to = activeTo.trim();
    if (!WALLET_ID.test(from) || !WALLET_ID.test(to)) {
      setError(errors("walletIdPair"));
      return;
    }
    let minor: string;
    try {
      minor = toMinorUnits(activeAmount);
    } catch (cause) {
      setError(describeError(cause));
      return;
    }
    try {
      const response = await transfer.mutateAsync({
        fromWalletId: from,
        toWalletId: to,
        amount: minor,
        referenceId,
      });
      clearPayload();
      setResult(response.data);
      setReplayed(response.replayed);
    } catch (cause) {
      setError(describeError(cause));
    }
  }

  return {
    fromWalletId: activeFrom,
    toWalletId: activeTo,
    amount: activeAmount,
    referenceId,
    error: activeError,
    replayed: activeReplayed,
    result: activeResult,
    isPending: transfer.isPending,
    setFrom,
    setTo,
    setAmount,
    setReferenceId,
    rotateReference,
    onSubmit,
  };
}
