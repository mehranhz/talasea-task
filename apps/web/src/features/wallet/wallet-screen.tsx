"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Field, Heading, Input, Note, Select, Surface, Text } from "@/design-system";
import { apiRequest, type Balance, type LedgerRow, type Movement } from "@/lib/api";
import { useDescribeError } from "@/lib/errors";
import { amountHint, formatMinor, newReferenceId, toMinorUnits, WALLET_ID } from "@/lib/money";
import { useReferenceId } from "@/lib/reference";
import { useSavedWallets } from "@/lib/wallets";

type Mode = "deposit" | "withdraw";
type HistoryType = "" | LedgerRow["type"];

export function WalletScreen() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const valid = WALLET_ID.test(id);
  const locale = useLocale();
  const t = useTranslations("wallet");
  const actions = useTranslations("actions");
  const ledger = useTranslations("ledger");
  const hints = useTranslations("hints");
  const common = useTranslations("common");
  const describeError = useDescribeError();
  const saved = useSavedWallets();
  const owner = saved.find((wallet) => wallet.id === id)?.userId ?? "";
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("");
  const [referenceId, setReferenceId] = useReferenceId();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [replayed, setReplayed] = useState(false);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryType>("");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyPending, setHistoryPending] = useState(false);

  const loadBalance = useCallback(async () => {
    const result = await apiRequest<Balance>(`/api/v1/wallets/${id}/balance`);
    setBalance(result.data);
  }, [id]);

  const loadHistory = useCallback(
    async (nextCursor: string | null, replace: boolean) => {
      const query = new URLSearchParams({ limit: "20" });
      if (nextCursor) query.set("cursor", nextCursor);
      if (filter) query.set("type", filter);
      setHistoryPending(true);
      setHistoryError(null);
      try {
        const result = await apiRequest<LedgerRow[]>(`/api/v1/wallets/${id}/transactions?${query.toString()}`);
        setRows((current) => (replace ? result.data : [...current, ...result.data]));
        setCursor(result.meta.nextCursor ?? null);
      } catch (error) {
        setHistoryError(describeError(error));
      } finally {
        setHistoryPending(false);
      }
    },
    [describeError, filter, id],
  );

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    const query = new URLSearchParams({ limit: "20" });
    if (filter) query.set("type", filter);
    void apiRequest<Balance>(`/api/v1/wallets/${id}/balance`)
      .then((result) => {
        if (!cancelled) setBalance(result.data);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(describeError(error));
      });
    void apiRequest<LedgerRow[]>(`/api/v1/wallets/${id}/transactions?${query.toString()}`)
      .then((result) => {
        if (cancelled) return;
        setRows(result.data);
        setCursor(result.meta.nextCursor ?? null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setHistoryError(describeError(error));
      });
    return () => {
      cancelled = true;
    };
  }, [describeError, filter, id, valid]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!balance) return;
    setFormError(null);
    setReplayed(false);
    let minor: string;
    try {
      minor = toMinorUnits(amount);
    } catch (error) {
      setFormError(describeError(error));
      return;
    }
    setPending(true);
    try {
      const result = await apiRequest<Movement>(`/api/v1/wallets/${id}/${mode}`, {
        method: "POST",
        body: JSON.stringify({ amount: minor, referenceId }),
      });
      setReplayed(result.replayed);
      setAmount("");
      setReferenceId(newReferenceId());
      await loadBalance();
      await loadHistory(null, true);
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setPending(false);
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
        <Heading size="display" className="mt-1">
          {balance ? formatMinor(balance.balance, balance.asset, locale) : loadError ? "—" : common("loadingValue")}
        </Heading>
        <Text variant="positive" size="sm" className="mt-2">
          {balance?.asset ?? ""}
        </Text>
        <Text as="span" variant="muted" size="xs" className="mt-1 block truncate font-mono">
          {id}
        </Text>
        {loadError ? <Note variant="error" className="mt-3">{loadError}</Note> : null}
      </section>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("movement")}>
          {(["deposit", "withdraw"] as const).map((item) => (
            <Button key={item} type="button" variant="choice" selected={mode === item} onClick={() => setMode(item)}>
              {t(`modes.${item}`)}
            </Button>
          ))}
        </div>
        <Field label={t("amount")} hint={hintText}>
          <Input
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            required
            placeholder={t("amountPlaceholder")}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label={t("reference")} hint={t("referenceHint")}>
          <Input
            name="referenceId"
            required
            minLength={1}
            maxLength={128}
            value={referenceId}
            onChange={(event) => setReferenceId(event.target.value)}
          />
        </Field>
        <Button type="button" variant="text" size="sm" onClick={() => setReferenceId(newReferenceId())}>
          {actions("newReference")}
        </Button>
        {replayed ? <Note variant="replay">{t("replayed")}</Note> : null}
        {formError ? <Note variant="error">{formError}</Note> : null}
        <Button type="submit" fullWidth pending={pending} pendingLabel={actions("pending")}>
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
        {rows.length === 0 && !historyPending ? (
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
                    {new Date(row.createdAt).toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}
                  </Text>
                  <Text as="span" variant="muted" size="xs" className="mt-1 block truncate font-mono">
                    {row.referenceId}
                  </Text>
                </Surface>
              </li>
            ))}
          </ul>
        )}
        {cursor ? (
          <Button
            type="button"
            variant="secondary"
            fullWidth
            pending={historyPending}
            pendingLabel={common("loading")}
            onClick={() => void loadHistory(cursor, false)}
          >
            {actions("loadMore")}
          </Button>
        ) : null}
      </section>
    </div>
  );
}
