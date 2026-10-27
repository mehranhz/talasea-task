"use client";

import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, Inbox } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import type { ChangeEvent } from "react";
import { Direction, TransactionType } from "@talasea/types";
import { Button, Field, Glyph, Heading, Input, Note, Select, Skeleton, Text } from "@talasea/ui";
import { ReferenceDisclosure } from "@/features/reference-disclosure";
import { usePathname } from "@/i18n/navigation";
import { useDescribeError } from "@/lib/errors";
import { amountHint, formatMinor } from "@/lib/money";
import { useSavedWallets, type SavedWallet } from "@/lib/wallets";
import { useWalletDetail, type HistoryType, type MovementMode } from "./use-wallet-detail";

const movementIcons = {
  deposit: ArrowDownToLine,
  withdraw: ArrowUpFromLine,
} as const;

export function ReplayedNote({ replayed, message }: { replayed: boolean; message: string }) {
  if (!replayed) return null;
  return <Note variant="replay">{message}</Note>;
}

export function WalletScreen({
  initialWallets = [],
  missingWalletIds = [],
}: {
  initialWallets?: SavedWallet[];
  missingWalletIds?: readonly string[];
}) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const id = typeof params.id === "string" ? params.id : "";
  return (
    <WalletScreenView key={`${pathname}:${id}`} id={id} initialWallets={initialWallets} missingWalletIds={missingWalletIds} />
  );
}

function WalletScreenView({
  id,
  initialWallets,
  missingWalletIds,
}: {
  id: string;
  initialWallets: SavedWallet[];
  missingWalletIds: readonly string[];
}) {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("wallet");
  const actions = useTranslations("actions");
  const ledger = useTranslations("ledger");
  const hints = useTranslations("hints");
  const describeError = useDescribeError();
  const saved = useSavedWallets(initialWallets, missingWalletIds);
  const detail = useWalletDetail(id);
  const owner = saved.find((wallet) => wallet.id === id)?.userId ?? "";

  const balance = detail.balance.data?.data;
  const loadError = detail.balance.isError ? describeError(detail.balance.error) : null;
  const historyError = detail.history.isError ? describeError(detail.history.error) : null;
  const rows = detail.rows;
  const hint = amountHint(detail.amount);
  const hintText =
    hint.kind === "minor" ? hints("minor", { value: hint.value }) : hint.kind === "decimals" ? hints("decimals") : undefined;
  const ownerLabel = owner || t("fallbackOwner");
  const meta = balance?.asset ? `${ownerLabel} · ${balance.asset}` : ownerLabel;

  function chooseMode(mode: MovementMode) {
    detail.setMode(mode);
  }

  function changeAmount(event: ChangeEvent<HTMLInputElement>) {
    detail.setAmount(event.target.value);
  }

  function changeFilter(event: ChangeEvent<HTMLSelectElement>) {
    detail.setFilter(event.target.value as HistoryType);
  }

  if (!detail.valid) {
    return (
      <Text variant="body" size="sm" className="text-danger">
        {t("invalidId")}
      </Text>
    );
  }

  return (
    <div className="stack">
      <header>
        {detail.balance.isPending ? (
          <Skeleton className="h-14 w-48" />
        ) : balance ? (
          <Heading size="display">{formatMinor(balance.balance, balance.asset, locale)}</Heading>
        ) : null}
        <Text variant="muted" size="sm" className="mt-2">
          {meta}
        </Text>
        {loadError ? (
          <Note variant="error" className="mt-3">
            {loadError}
          </Note>
        ) : null}
      </header>

      <form noValidate onSubmit={detail.onSubmit} className="stack-form">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("movement")}>
          {(["deposit", "withdraw"] as const).map((item) => (
            <Button key={item} type="button" variant="choice" selected={detail.mode === item} onClick={() => chooseMode(item)}>
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
            onChange={changeAmount}
          />
        </Field>
        <ReferenceDisclosure
          label={t("reference")}
          hint={t("referenceHint")}
          value={detail.referenceId}
          rotateLabel={actions("newReference")}
          onChange={detail.setReferenceId}
          onRotate={detail.rotateReference}
        />
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
            <Select size="sm" value={detail.filter} onChange={changeFilter}>
              <option value="">{ledger("all")}</option>
              <option value={TransactionType.Deposit}>{ledger("deposits")}</option>
              <option value={TransactionType.Withdrawal}>{ledger("withdrawals")}</option>
              <option value={TransactionType.TransferIn}>{ledger("transfersIn")}</option>
              <option value={TransactionType.TransferOut}>{ledger("transfersOut")}</option>
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
          <ul className="list-rows">
            {rows.map((row) => {
              const credit = row.direction === Direction.Credit;
              return (
                <li key={row.id} className="list-row">
                  <span className="min-w-0">
                    <Text as="span" variant="label" size="sm" className="block">
                      {ledger(row.type)}
                    </Text>
                    <Text variant="muted" size="xs" className="mt-1">
                      {format.dateTime(new Date(row.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                    </Text>
                  </span>
                  <Text
                    as="span"
                    variant={credit ? "positive" : "body"}
                    size="sm"
                    className="shrink-0 font-semibold tabular-nums"
                  >
                    {credit ? "+" : "−"}
                    {formatMinor(row.amount.replace(/^-/, ""), row.asset, locale)}
                  </Text>
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
