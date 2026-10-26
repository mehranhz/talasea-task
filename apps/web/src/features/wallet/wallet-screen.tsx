"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, Heading, Input, Note, Select, Skeleton, Surface, Text } from "@/design-system";
import { useDescribeError } from "@/lib/errors";
import { amountHint, formatMinor, newReferenceId, toMinorUnits, WALLET_ID } from "@/lib/money";
import { useReferenceId } from "@/lib/reference";
import { useSavedWallets } from "@/lib/wallets";
import { useWalletDetail, type HistoryType } from "./use-wallet-detail";

type Mode = "deposit" | "withdraw";

export function ReplayedNote({ replayed, message }: { replayed: boolean; message: string }) {
  if (!replayed) return null;
  return <Note variant="replay">{message}</Note>;
}

export function WalletScreen() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const valid = WALLET_ID.test(id);
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("wallet");
  const actions = useTranslations("actions");
  const ledger = useTranslations("ledger");
  const hints = useTranslations("hints");
  const errors = useTranslations("errors");
  const describeError = useDescribeError();
  const saved = useSavedWallets();
  const owner = saved.find((wallet) => wallet.id === id)?.userId ?? "";
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("");
  const [referenceId, setReferenceId] = useReferenceId();
  const [filter, setFilter] = useState<HistoryType>("");
  const detail = useWalletDetail(id, filter, valid);
  const [formError, setFormError] = useState<string | null>(null);
  const [replayed, setReplayed] = useState(false);

  const balance = detail.balance.data?.data;
  const loadError = detail.balance.isError ? describeError(detail.balance.error) : null;
  const historyError = detail.history.isError ? describeError(detail.history.error) : null;
  const rows = detail.rows;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!balance) return;
    setFormError(null);
    setReplayed(false);
    if (!referenceId.trim()) {
      setFormError(errors("required"));
      return;
    }
    let minor: string;
    try {
      minor = toMinorUnits(amount);
    } catch (error) {
      setFormError(describeError(error));
      return;
    }
    try {
      const result = await detail.move.mutateAsync({ mode, amount: minor, referenceId });
      setReplayed(result.replayed);
      setAmount("");
      setReferenceId(newReferenceId());
    } catch (error) {
      setFormError(describeError(error));
    }
  }

  const hint = amountHint(amount);
  const hintText =
    hint.kind === "minor" ? hints("minor", { value: hint.value }) : hint.kind === "empty" ? hints("empty") : hints("decimals");

  if (!valid) {
    return (
      <Text variant="body" size="sm" className="text-danger">
        {t("invalidId")}
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <Text variant="muted" size="sm">
          {owner || t("fallbackOwner")}
        </Text>
        {detail.balance.isPending ? (
          <Skeleton className="mt-2 h-10 w-40" />
        ) : (
          <Heading size="display" className="mt-1">
            {balance ? formatMinor(balance.balance, balance.asset, locale) : "—"}
          </Heading>
        )}
        <Text variant="positive" size="sm" className="mt-2">
          {balance?.asset ?? ""}
        </Text>
        <Text as="span" variant="muted" size="xs" className="mt-1 block truncate font-mono">
          {id}
        </Text>
        {loadError ? (
          <Note variant="error" className="mt-3">
            {loadError}
          </Note>
        ) : null}
      </section>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("movement")}>
          {(["deposit", "withdraw"] as const).map((item) => (
            <Button key={item} type="button" variant="choice" selected={mode === item} onClick={() => setMode(item)}>
              {t(`modes.${item}`)}
            </Button>
          ))}
        </div>
        <Field label={t("amount")} hint={hintText} error={formError ?? undefined}>
          <Input
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t("amountPlaceholder")}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label={t("reference")} hint={t("referenceHint")}>
          <Input
            name="referenceId"
            minLength={1}
            maxLength={128}
            value={referenceId}
            onChange={(event) => setReferenceId(event.target.value)}
          />
        </Field>
        <Button type="button" variant="text" size="sm" onClick={() => setReferenceId(newReferenceId())}>
          {actions("newReference")}
        </Button>
        <ReplayedNote replayed={replayed} message={t("replayed")} />
        <Button type="submit" fullWidth pending={detail.move.isPending} pendingLabel={actions("pending")}>
          {mode === "deposit" ? actions("deposit") : actions("withdraw")}
        </Button>
      </form>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Heading level={2} size="sm">
            {t("history")}
          </Heading>
          <label className="text-sm text-muted">
            <span className="sr-only">{t("filter")}</span>
            <Select size="sm" value={filter} onChange={(event) => setFilter(event.target.value as HistoryType)}>
              <option value="">{ledger("all")}</option>
              <option value="DEPOSIT">{ledger("deposits")}</option>
              <option value="WITHDRAWAL">{ledger("withdrawals")}</option>
              <option value="TRANSFER_IN">{ledger("transfersIn")}</option>
              <option value="TRANSFER_OUT">{ledger("transfersOut")}</option>
            </Select>
          </label>
        </div>
        {historyError ? <Note variant="error">{historyError}</Note> : null}
        {detail.history.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : rows.length === 0 ? (
          <Text variant="muted" size="sm">
            {t("emptyHistory")}
          </Text>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.id}>
                <Surface variant="card" padding="sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <Text as="span" variant="label" size="sm">
                      {ledger(row.type)}
                    </Text>
                    <Text as="span" variant={row.direction === "CREDIT" ? "positive" : "balance"} size="md">
                      {row.direction === "CREDIT" ? "+" : "−"}
                      {formatMinor(row.amount, row.asset, locale).replace(/^[−-]/, "")}
                    </Text>
                  </div>
                  <Text variant="muted" size="xs" className="mt-1">
                    {t("balanceAfter", { amount: formatMinor(row.balanceAfter, row.asset, locale) })}
                    {" · "}
                    {format.dateTime(new Date(row.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                  </Text>
                  <Text as="span" variant="muted" size="xs" className="mt-1 block truncate font-mono">
                    {row.referenceId}
                  </Text>
                </Surface>
              </li>
            ))}
          </ul>
        )}
        {detail.history.hasNextPage ? (
          <Button
            type="button"
            variant="secondary"
            fullWidth
            pending={detail.history.isFetchingNextPage}
            pendingLabel={actions("pending")}
            onClick={() => void detail.history.fetchNextPage()}
          >
            {actions("loadMore")}
          </Button>
        ) : null}
      </section>
    </div>
  );
}
