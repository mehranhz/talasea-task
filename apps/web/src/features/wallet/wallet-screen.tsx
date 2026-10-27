"use client";

import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  ChevronDown,
  Inbox,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Button, Field, Glyph, Heading, Input, Note, Select, Skeleton, Surface, Text } from "@talasea/ui";
import { usePathname } from "@/i18n/navigation";
import type { LedgerRow } from "@/lib/api";
import { useDescribeError } from "@/lib/errors";
import { amountHint, formatMinor } from "@/lib/money";
import { useSavedWallets } from "@/lib/wallets";
import { useWalletDetail, type HistoryType } from "./use-wallet-detail";

const ledgerIcons = {
  DEPOSIT: ArrowDownToLine,
  WITHDRAWAL: ArrowUpFromLine,
  TRANSFER_IN: ArrowDownLeft,
  TRANSFER_OUT: ArrowUpRight,
} satisfies Record<LedgerRow["type"], LucideIcon>;

const movementIcons = {
  deposit: ArrowDownToLine,
  withdraw: ArrowUpFromLine,
} as const;

export function ReplayedNote({ replayed, message }: { replayed: boolean; message: string }) {
  if (!replayed) return null;
  return <Note variant="replay">{message}</Note>;
}

export function WalletScreen() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const id = typeof params.id === "string" ? params.id : "";
  return <WalletScreenView key={`${pathname}:${id}`} id={id} />;
}

function WalletScreenView({ id }: { id: string }) {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("wallet");
  const actions = useTranslations("actions");
  const ledger = useTranslations("ledger");
  const hints = useTranslations("hints");
  const describeError = useDescribeError();
  const saved = useSavedWallets();
  const detail = useWalletDetail(id);
  const owner = saved.find((wallet) => wallet.id === id)?.userId ?? "";

  const balance = detail.balance.data?.data;
  const loadError = detail.balance.isError ? describeError(detail.balance.error) : null;
  const historyError = detail.history.isError ? describeError(detail.history.error) : null;
  const rows = detail.rows;
  const hint = amountHint(detail.amount);
  const hintText =
    hint.kind === "minor" ? hints("minor", { value: hint.value }) : hint.kind === "empty" ? hints("empty") : hints("decimals");

  if (!detail.valid) {
    return (
      <Text variant="body" size="sm" className="text-danger">
        {t("invalidId")}
      </Text>
    );
  }

  return (
    <div className="stack">
      <Surface variant="card" padding="md" className="balance-panel">
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
        <Text variant="muted" size="sm" className="mt-2">
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
      </Surface>

      <form noValidate onSubmit={detail.onSubmit} className="stack-form">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("movement")}>
          {(["deposit", "withdraw"] as const).map((item) => (
            <Button key={item} type="button" variant="choice" selected={detail.mode === item} onClick={() => detail.setMode(item)}>
              <Glyph icon={movementIcons[item]} />
              {t(`modes.${item}`)}
            </Button>
          ))}
        </div>
        <Field label={t("amount")} hint={hintText} error={detail.formError ?? undefined}>
          <Input
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t("amountPlaceholder")}
            value={detail.amount}
            onChange={(event) => detail.setAmount(event.target.value)}
          />
        </Field>
        <Field label={t("reference")} hint={t("referenceHint")}>
          <Input
            name="referenceId"
            minLength={1}
            maxLength={128}
            value={detail.referenceId}
            onChange={(event) => detail.setReferenceId(event.target.value)}
          />
        </Field>
        <Button type="button" variant="text" size="sm" onClick={() => detail.rotateReference()}>
          <Glyph icon={RefreshCw} />
          {actions("newReference")}
        </Button>
        <ReplayedNote replayed={detail.replayed} message={t("replayed")} />
        <Button type="submit" fullWidth pending={detail.movePending} pendingLabel={actions("pending")}>
          <Glyph icon={movementIcons[detail.mode]} />
          {detail.mode === "deposit" ? actions("deposit") : actions("withdraw")}
        </Button>
      </form>

      <section className="flex flex-col gap-3">
        <div className="section-head">
          <Heading level={2} size="sm">
            {t("history")}
          </Heading>
          <label className="filter-field">
            <span className="sr-only">{t("filter")}</span>
            <Select value={detail.filter} onChange={(event) => detail.setFilter(event.target.value as HistoryType)}>
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
          <div className="note-quiet flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted">
            <Glyph icon={Inbox} />
            {t("emptyHistory")}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => {
              const directional = row.type === "TRANSFER_IN" || row.type === "TRANSFER_OUT";
              return (
                <li key={row.id}>
                  <Surface variant="card" padding="sm">
                    <div className="flex items-start gap-3">
                      <span className="medallion medallion-sm" aria-hidden="true">
                        <Glyph icon={ledgerIcons[row.type]} directional={directional} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <Text as="span" variant="label" size="sm">
                            {ledger(row.type)}
                          </Text>
                          <Text
                            as="span"
                            variant={row.direction === "CREDIT" ? "positive" : "body"}
                            size="sm"
                            className="font-semibold tabular-nums"
                          >
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
                      </div>
                    </div>
                  </Surface>
                </li>
              );
            })}
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
            <Glyph icon={ChevronDown} />
            {actions("loadMore")}
          </Button>
        ) : null}
      </section>
    </div>
  );
}
