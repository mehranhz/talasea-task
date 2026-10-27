"use client";

import { ArrowLeftRight, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Field, Glyph, Heading, Input, Select, Surface, Text } from "@talasea/ui";
import { ReplayedNote } from "@/features/wallet/wallet-screen";
import { usePathname } from "@/i18n/navigation";
import { amountHint, formatMinor } from "@/lib/money";
import { useSavedWallets } from "@/lib/wallets";
import { useTransfer } from "./use-transfer";

export function TransferScreen() {
  const pathname = usePathname();
  return <TransferScreenView key={pathname} />;
}

function TransferScreenView() {
  const wallets = useSavedWallets();
  const locale = useLocale();
  const t = useTranslations("transfer");
  const actions = useTranslations("actions");
  const hints = useTranslations("hints");
  const transfer = useTransfer();
  const from = wallets.find((wallet) => wallet.id === transfer.fromWalletId.trim());
  const hint = amountHint(transfer.amount);
  const amountHintText =
    hint.kind === "minor" ? hints("minor", { value: hint.value }) : hint.kind === "empty" ? hints("empty") : hints("decimals");
  const hintText = from ? `${amountHintText} · ${from.asset}` : amountHintText;

  return (
    <div className="stack">
      <div>
        <Heading size="lg">{t("title")}</Heading>
        <Text variant="muted" size="sm" className="mt-1">
          {t("intro")}
        </Text>
      </div>

      <form noValidate onSubmit={transfer.onSubmit} className="stack-form">
        {wallets.length > 0 ? (
          <Field label={t("savedSender")}>
            <Select
              value={wallets.some((wallet) => wallet.id === transfer.fromWalletId) ? transfer.fromWalletId : ""}
              onChange={(event) => transfer.setFrom(event.target.value)}
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
            value={transfer.fromWalletId}
            onChange={(event) => transfer.setFrom(event.target.value)}
          />
        </Field>
        <Field label={t("to")}>
          <Input
            name="toWalletId"
            spellCheck={false}
            autoComplete="off"
            value={transfer.toWalletId}
            onChange={(event) => transfer.setTo(event.target.value)}
          />
        </Field>
        <Field label={t("amount")} hint={hintText} error={transfer.error ?? undefined}>
          <Input
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t("amountPlaceholder")}
            value={transfer.amount}
            onChange={(event) => transfer.setAmount(event.target.value)}
          />
        </Field>
        <Field label={t("reference")}>
          <Input
            name="referenceId"
            minLength={1}
            maxLength={128}
            value={transfer.referenceId}
            onChange={(event) => transfer.setReferenceId(event.target.value)}
          />
        </Field>
        <Button type="button" variant="text" size="sm" onClick={() => transfer.rotateReference()}>
          <Glyph icon={RefreshCw} />
          {actions("newReference")}
        </Button>
        <ReplayedNote replayed={transfer.replayed} message={t("replayed")} />
        <Button type="submit" fullWidth pending={transfer.isPending} pendingLabel={actions("pending")}>
          <Glyph icon={ArrowLeftRight} />
          {actions("transfer")}
        </Button>
      </form>

      {transfer.result ? (
        <Surface variant="card" padding="md">
          <Heading level={2} size="sm">
            {t("result")}
          </Heading>
          <Text variant="muted" size="sm" className="mt-2">
            {t("senderBalance", { amount: formatMinor(transfer.result.fromBalance, transfer.result.asset, locale) })}
          </Text>
          <Text variant="muted" size="sm">
            {t("receiverBalance", { amount: formatMinor(transfer.result.toBalance, transfer.result.asset, locale) })}
          </Text>
          <Text as="span" variant="muted" size="xs" className="mt-2 block truncate font-mono">
            {transfer.result.transferId}
          </Text>
        </Surface>
      ) : null}
    </div>
  );
}
