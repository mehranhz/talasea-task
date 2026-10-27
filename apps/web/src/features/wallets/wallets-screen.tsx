"use client";

import { Check, Copy, FolderOpen, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type ChangeEvent, type MouseEvent } from "react";
import { Button, Field, Glyph, Heading, Input, Note, Select, Skeleton, Text } from "@talasea/ui";
import { Link } from "@/i18n/navigation";
import type { SavedWallet } from "@/lib/wallets";
import { ASSETS, useWalletDirectory, type WalletAsset } from "./use-wallet-directory";

const COPY_FEEDBACK_MS = 2000;

async function copyWalletId(walletId: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(walletId);
    return true;
  } catch {
    return false;
  }
}

function CopyWalletAddress({ walletId }: { walletId: string }) {
  const t = useTranslations("wallets");
  const [feedback, setFeedback] = useState<"copied" | "error" | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), COPY_FEEDBACK_MS);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  function onCopy(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    void copyWalletId(walletId).then(
      (copied) => setFeedback(copied ? "copied" : "error"),
      () => setFeedback("error"),
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="text"
        size="sm"
        className="copy-address"
        aria-label={t("copyAddress")}
        onClick={onCopy}
      >
        <Glyph icon={feedback === "copied" ? Check : Copy} />
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {feedback === "copied" ? t("copied") : ""}
      </span>
      {feedback === "error" ? (
        <Text as="span" role="alert" size="sm" className="basis-full min-w-0 text-danger">
          {t("copyFailed")}
        </Text>
      ) : null}
    </>
  );
}

export function WalletsScreen({
  initialWallets = [],
  missingWalletIds = [],
}: {
  initialWallets?: SavedWallet[];
  missingWalletIds?: readonly string[];
}) {
  const locale = useLocale();
  const t = useTranslations("wallets");
  const actions = useTranslations("actions");
  const directory = useWalletDirectory(initialWallets, missingWalletIds);
  const [showOpen, setShowOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const hasWallets = directory.wallets.length > 0;

  function openAdd() {
    setShowAdd(true);
  }

  function openById() {
    setShowOpen(true);
  }

  function changeUserId(event: ChangeEvent<HTMLInputElement>) {
    directory.setUserId(event.target.value);
  }

  function changeAsset(event: ChangeEvent<HTMLSelectElement>) {
    directory.setAsset(event.target.value as WalletAsset);
  }

  function changeOpenId(event: ChangeEvent<HTMLInputElement>) {
    directory.setOpenId(event.target.value);
  }

  const showCreate = !hasWallets || showAdd;
  const showOpenForm = hasWallets ? showAdd : showOpen;

  return (
    <div className="stack" lang={locale}>
      <section aria-label={t("savedLabel")}>
        {hasWallets ? (
          <ul className="list-rows">
            {directory.wallets.map((wallet) => {
              const balance = directory.balanceFor(wallet.id);
              return (
                <li key={wallet.id}>
                  <div className="list-row flex-wrap">
                    <Link
                      href={`/wallets/${wallet.id}`}
                      className="list-row-main flex min-w-0 flex-1 items-center justify-between gap-3 text-inherit no-underline"
                    >
                      <span className="min-w-0">
                        <Text as="span" variant="label" size="sm" className="block truncate">
                          {wallet.userId || t("openedById")}
                        </Text>
                        <Text as="span" variant="muted" size="xs" className="mt-1 block">
                          {wallet.asset}
                        </Text>
                      </span>
                      {balance.status === "ready" ? (
                        <Text as="span" variant="balance" className="shrink-0">
                          {balance.text}
                        </Text>
                      ) : balance.status === "error" ? (
                        <Text as="span" variant="muted" size="xs" className="max-w-40 shrink text-end leading-snug">
                          {balance.message}
                        </Text>
                      ) : (
                        <Skeleton className="h-7 w-24 shrink-0" />
                      )}
                    </Link>
                    <CopyWalletAddress walletId={wallet.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Note variant="neutral" size="md">
            {t("empty")}
          </Note>
        )}
      </section>

      {hasWallets && !showAdd ? (
        <Button type="button" variant="text" onClick={openAdd}>
          {t("addWallet")}
        </Button>
      ) : null}

      {showCreate ? (
        <form noValidate onSubmit={directory.onCreate} className="stack-form">
          <Heading level={2} size="sm">
            {t("createTitle")}
          </Heading>
          <Field label={t("userId")} hint={t("userIdHint")} error={directory.createError ?? undefined}>
            <Input
              name="userId"
              autoComplete="username"
              maxLength={128}
              value={directory.userId}
              onChange={changeUserId}
            />
          </Field>
          <Field label={t("asset")}>
            <Select
              name="asset"
              value={directory.asset}
              onChange={changeAsset}
            >
              {ASSETS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" fullWidth pending={directory.createPending} pendingLabel={actions("pending")}>
            <Glyph icon={Plus} />
            {actions("createWallet")}
          </Button>
        </form>
      ) : null}

      {!hasWallets && !showOpen ? (
        <Button type="button" variant="text" onClick={openById}>
          {t("openTitle")}
        </Button>
      ) : null}

      {showOpenForm ? (
        <form noValidate onSubmit={directory.onOpen} className="stack-form">
          <Heading level={2} size="sm">
            {t("openTitle")}
          </Heading>
          <Field label={t("walletId")} error={directory.openError ?? undefined}>
            <Input
              name="walletId"
              autoComplete="off"
              spellCheck={false}
              value={directory.openId}
              onChange={changeOpenId}
            />
          </Field>
          <Button type="submit" fullWidth pending={directory.openPending} pendingLabel={actions("pending")}>
            <Glyph icon={FolderOpen} />
            {actions("openWallet")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
