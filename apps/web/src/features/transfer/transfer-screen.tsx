"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button, Field, Heading, Input, Select, Surface, Text } from "@/design-system";
import { useDescribeError } from "@/lib/errors";
import { amountHint, formatMinor, newReferenceId, toMinorUnits, WALLET_ID } from "@/lib/money";
import { useReferenceId } from "@/lib/reference";
import { useSavedWallets } from "@/lib/wallets";
import { ReplayedNote } from "@/features/wallet/wallet-screen";
import { useTransfer } from "./use-transfer";

export function TransferScreen() {
  const wallets = useSavedWallets();
  const locale = useLocale();
  const t = useTranslations("transfer");
  const actions = useTranslations("actions");
  const hints = useTranslations("hints");
  const errors = useTranslations("errors");
  const describeError = useDescribeError();
  const transfer = useTransfer();
  const [fromWalletId, setFromWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [amount, setAmount] = useState("");
  const [referenceId, setReferenceId] = useReferenceId();
  const [error, setError] = useState<string | null>(null);
  const [replayed, setReplayed] = useState(false);
  const [result, setResult] = useState<{ fromBalance: string; toBalance: string; asset: string; transferId: string } | null>(
    null,
  );

  const from = wallets.find((wallet) => wallet.id === fromWalletId.trim());
  const hint = amountHint(amount);
  const amountHintText =
    hint.kind === "minor" ? hints("minor", { value: hint.value }) : hint.kind === "empty" ? hints("empty") : hints("decimals");
  const hintText = from ? `${amountHintText} · ${from.asset}` : amountHintText;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setReplayed(false);
    setResult(null);
    if (!referenceId.trim()) {
      setError(errors("required"));
      return;
    }
    if (!WALLET_ID.test(fromWalletId.trim()) || !WALLET_ID.test(toWalletId.trim())) {
      setError(errors("walletIdPair"));
      return;
    }
    let minor: string;
    try {
      minor = toMinorUnits(amount);
    } catch (cause) {
      setError(describeError(cause));
      return;
    }
    try {
      const response = await transfer.mutateAsync({
        fromWalletId: fromWalletId.trim(),
        toWalletId: toWalletId.trim(),
        amount: minor,
        referenceId,
      });
      setResult(response.data);
      setReplayed(response.replayed);
      setAmount("");
      setReferenceId(newReferenceId());
    } catch (cause) {
      setError(describeError(cause));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Heading size="lg">{t("title")}</Heading>
        <Text variant="muted" size="sm" className="mt-1">
          {t("intro")}
        </Text>
      </div>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {wallets.length > 0 ? (
          <Field label={t("savedSender")}>
            <Select
              value={wallets.some((wallet) => wallet.id === fromWalletId) ? fromWalletId : ""}
              onChange={(event) => setFromWalletId(event.target.value)}
            >
              <option value="">{t("typeId")}</option>
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.asset} · {wallet.userId || wallet.id}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label={t("from")}>
          <Input
            name="fromWalletId"
            spellCheck={false}
            autoComplete="off"
            value={fromWalletId}
            onChange={(event) => setFromWalletId(event.target.value)}
          />
        </Field>
        <Field label={t("to")}>
          <Input
            name="toWalletId"
            spellCheck={false}
            autoComplete="off"
            value={toWalletId}
            onChange={(event) => setToWalletId(event.target.value)}
          />
        </Field>
        <Field label={t("amount")} hint={hintText} error={error ?? undefined}>
          <Input
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t("amountPlaceholder")}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label={t("reference")}>
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
        <Button type="submit" fullWidth pending={transfer.isPending} pendingLabel={actions("pending")}>
          {actions("transfer")}
        </Button>
      </form>

      {result ? (
        <Surface variant="card" padding="md">
          <Heading level={2} size="sm">
            {t("result")}
          </Heading>
          <Text variant="muted" size="sm" className="mt-2">
            {t("senderBalance", { amount: formatMinor(result.fromBalance, result.asset, locale) })}
          </Text>
          <Text variant="muted" size="sm">
            {t("receiverBalance", { amount: formatMinor(result.toBalance, result.asset, locale) })}
          </Text>
          <Text as="span" variant="muted" size="xs" className="mt-2 block truncate font-mono">
            {result.transferId}
          </Text>
        </Surface>
      ) : null}
    </div>
  );
}
