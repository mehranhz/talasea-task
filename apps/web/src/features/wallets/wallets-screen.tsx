"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button, Field, Heading, Input, Note, Select, Skeleton, Surface, Text } from "@/design-system";
import { Link, useRouter } from "@/i18n/navigation";
import { useDescribeError } from "@/lib/errors";
import { WALLET_ID } from "@/lib/money";
import { ASSETS, useWalletDirectory, type WalletAsset } from "./use-wallet-directory";

export function WalletsScreen() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("wallets");
  const actions = useTranslations("actions");
  const errors = useTranslations("errors");
  const describeError = useDescribeError();
  const directory = useWalletDirectory();
  const [userId, setUserId] = useState("");
  const [asset, setAsset] = useState<WalletAsset>("USD");
  const [openId, setOpenId] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    if (!userId.trim()) {
      setCreateError(errors("required"));
      return;
    }
    try {
      const result = await directory.create.mutateAsync({ userId: userId.trim(), asset });
      router.push(`/wallets/${result.data.id}`);
    } catch (error) {
      setCreateError(describeError(error));
    }
  }

  async function onOpen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOpenError(null);
    const id = openId.trim();
    if (!WALLET_ID.test(id)) {
      setOpenError(errors("walletId"));
      return;
    }
    try {
      await directory.open.mutateAsync(id);
      router.push(`/wallets/${id}`);
    } catch (error) {
      setOpenError(describeError(error));
    }
  }

  const status =
    directory.status === "checking" ? t("checking") : directory.status === "online" ? t("online") : t("offline");

  return (
    <div className="flex flex-col gap-8" lang={locale}>
      <div>
        <Heading size="lg">{t("title")}</Heading>
        <Text variant="muted" size="sm" className="mt-1" role="status">
          {status}
        </Text>
      </div>

      <section className="flex flex-col gap-3" aria-label={t("savedLabel")}>
        {directory.wallets.length === 0 ? (
          <Note variant="neutral" size="md">
            {t("empty")}
          </Note>
        ) : (
          directory.wallets.map((wallet) => {
            const balance = directory.balanceText(wallet.id);
            return (
              <Link key={wallet.id} href={`/wallets/${wallet.id}`} className="block">
                <Surface variant="card" padding="md">
                  <div className="flex items-baseline justify-between gap-3">
                    {balance ? (
                      <Text variant="balance" size="lg">
                        {balance}
                      </Text>
                    ) : (
                      <Skeleton className="h-8 w-32" />
                    )}
                    <Text variant="positive" size="sm">
                      {wallet.asset}
                    </Text>
                  </div>
                  <Text variant="muted" size="sm" className="mt-2 truncate">
                    {wallet.userId || t("openedById")}
                  </Text>
                  <Text as="span" variant="muted" size="xs" className="mt-1 block truncate font-mono">
                    {wallet.id}
                  </Text>
                </Surface>
              </Link>
            );
          })
        )}
      </section>

      <form noValidate onSubmit={onCreate} className="flex flex-col gap-4">
        <Heading level={2} size="sm">
          {t("createTitle")}
        </Heading>
        <Field label={t("userId")} hint={t("userIdHint")} error={createError ?? undefined}>
          <Input
            name="userId"
            autoComplete="username"
            maxLength={128}
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
          />
        </Field>
        <Field label={t("asset")}>
          <Select name="asset" value={asset} onChange={(event) => setAsset(event.target.value as WalletAsset)}>
            {ASSETS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" fullWidth pending={directory.create.isPending} pendingLabel={actions("pending")}>
          {actions("createWallet")}
        </Button>
      </form>

      <form noValidate onSubmit={onOpen} className="flex flex-col gap-4">
        <Heading level={2} size="sm">
          {t("openTitle")}
        </Heading>
        <Field label={t("walletId")} error={openError ?? undefined}>
          <Input
            name="walletId"
            autoComplete="off"
            spellCheck={false}
            value={openId}
            onChange={(event) => setOpenId(event.target.value)}
          />
        </Field>
        <Button type="submit" fullWidth pending={directory.open.isPending} pendingLabel={actions("pending")}>
          {actions("openWallet")}
        </Button>
      </form>
    </div>
  );
}
