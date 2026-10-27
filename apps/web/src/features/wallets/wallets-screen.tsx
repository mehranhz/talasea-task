"use client";

import { ChevronRight, FolderOpen, Plus, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Field, Glyph, Heading, Input, Note, Select, Skeleton, Surface, Text } from "@talasea/ui";
import { Link } from "@/i18n/navigation";
import { ASSETS, useWalletDirectory, type WalletAsset } from "./use-wallet-directory";

export function WalletsScreen() {
  const locale = useLocale();
  const t = useTranslations("wallets");
  const actions = useTranslations("actions");
  const directory = useWalletDirectory();

  const status =
    directory.status === "checking" ? t("checking") : directory.status === "online" ? t("online") : t("offline");
  const dotState = directory.status === "checking" ? undefined : directory.status;

  return (
    <div className="stack" lang={locale}>
      <div>
        <Heading size="lg">{t("title")}</Heading>
        <Text variant="muted" size="sm" className="mt-1 flex items-center gap-2" role="status">
          <span className="status-dot" data-state={dotState} aria-hidden="true" />
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
              <Link key={wallet.id} href={`/wallets/${wallet.id}`} className="card-link">
                <Surface variant="card" padding="md">
                  <div className="flex items-center gap-3">
                    <span className="medallion" aria-hidden="true">
                      <Glyph icon={Wallet} />
                    </span>
                    <div className="min-w-0 flex-1">
                      {balance ? (
                        <Text variant="balance">{balance}</Text>
                      ) : (
                        <Skeleton className="h-8 w-32" />
                      )}
                      <Text variant="muted" size="sm" className="mt-1 truncate">
                        {wallet.userId || t("openedById")}
                      </Text>
                      <Text as="span" variant="muted" size="xs" className="mt-1 block truncate font-mono">
                        {wallet.id}
                      </Text>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Text variant="muted" size="sm">
                        {wallet.asset}
                      </Text>
                      <Glyph icon={ChevronRight} directional />
                    </div>
                  </div>
                </Surface>
              </Link>
            );
          })
        )}
      </section>

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
            onChange={(event) => directory.setUserId(event.target.value)}
          />
        </Field>
        <Field label={t("asset")}>
          <Select
            name="asset"
            value={directory.asset}
            onChange={(event) => directory.setAsset(event.target.value as WalletAsset)}
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
            onChange={(event) => directory.setOpenId(event.target.value)}
          />
        </Field>
        <Button type="submit" fullWidth pending={directory.openPending} pendingLabel={actions("pending")}>
          <Glyph icon={FolderOpen} />
          {actions("openWallet")}
        </Button>
      </form>
    </div>
  );
}
