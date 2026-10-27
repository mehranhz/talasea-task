"use client";

import { ArrowLeftRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ChangeEvent } from "react";
import { Button, Field, Glyph, Heading, Input, Select, Surface, Text } from "@talasea/ui";
import { ReferenceDisclosure } from "@/features/reference-disclosure";
import { ReplayedNote } from "@/features/wallet/wallet-screen";
import { usePathname } from "@/i18n/navigation";
import { amountHint, formatMinor } from "@/lib/money";
import { useSavedWallets, type SavedWallet } from "@/lib/wallets";
import { useTransfer } from "./use-transfer";

const TYPE_ID = "type-id";

export function TransferScreen({ initialWallets = [] }: { initialWallets?: SavedWallet[] }) {
  const pathname = usePathname();
  return <TransferScreenView key={pathname} initialWallets={initialWallets} />;
}

function TransferScreenView({ initialWallets }: { initialWallets: SavedWallet[] }) {
  const wallets = useSavedWallets(initialWallets);
  const locale = useLocale();
  const t = useTranslations("transfer");
  const actions = useTranslations("actions");
  const hints = useTranslations("hints");
  const transfer = useTransfer();
  const [typing, setTyping] = useState(false);
  const from = wallets.find((wallet) => wallet.id === transfer.fromWalletId.trim());
  const savedMatch = wallets.some((wallet) => wallet.id === transfer.fromWalletId);
  const selectValue = savedMatch ? transfer.fromWalletId : typing ? TYPE_ID : "";
  const hint = amountHint(transfer.amount);
  const amountHintText =
    hint.kind === "minor" ? hints("minor", { value: hint.value }) : hint.kind === "decimals" ? hints("decimals") : undefined;
  const hintText = amountHintText && from ? `${amountHintText} · ${from.asset}` : amountHintText;

  function onSender(value: string) {
    if (value === TYPE_ID) {
      setTyping(true);
      if (savedMatch) transfer.setFrom("");
      return;
    }
    setTyping(false);
    transfer.setFrom(value);
  }

  function changeSender(event: ChangeEvent<HTMLSelectElement>) {
    onSender(event.target.value);
  }

  function changeFrom(event: ChangeEvent<HTMLInputElement>) {
    transfer.setFrom(event.target.value);
  }

  function changeTo(event: ChangeEvent<HTMLInputElement>) {
    transfer.setTo(event.target.value);
  }

  function changeAmount(event: ChangeEvent<HTMLInputElement>) {
    transfer.setAmount(event.target.value);
  }

  return (
    <div className="stack">
      <Heading size="lg">{t("title")}</Heading>

      <form noValidate onSubmit={transfer.onSubmit} className="stack-form">
        {wallets.length > 0 ? (
          <Field label={t("from")}>
            <Select value={selectValue} onChange={changeSender}>
              <option value="">{t("savedSender")}</option>
              <option value={TYPE_ID}>{t("typeId")}</option>
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.asset} · {wallet.userId || wallet.id}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {wallets.length === 0 || typing ? (
          <Field label={wallets.length === 0 ? t("from") : t("typeId")}>
            <Input
              name="fromWalletId"
              spellCheck={false}
              autoComplete="off"
              value={transfer.fromWalletId}
              onChange={changeFrom}
            />
          </Field>
        ) : null}
        <Field label={t("to")}>
          <Input
            name="toWalletId"
            spellCheck={false}
            autoComplete="off"
            value={transfer.toWalletId}
            onChange={changeTo}
          />
        </Field>
        <Field label={t("amount")} hint={hintText} error={transfer.error ?? undefined}>
          <Input
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t("amountPlaceholder")}
            value={transfer.amount}
            onChange={changeAmount}
          />
        </Field>
        <ReferenceDisclosure
          label={t("reference")}
          value={transfer.referenceId}
          rotateLabel={actions("newReference")}
          onChange={transfer.setReferenceId}
          onRotate={transfer.rotateReference}
        />
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
        </Surface>
      ) : null}
    </div>
  );
}
