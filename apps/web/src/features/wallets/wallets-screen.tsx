"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Field, Heading, Input, Note, Select, Surface, Text } from "@/design-system";
import { Link, useRouter } from "@/i18n/navigation";
import { apiRequest, type Balance, type CreatedWallet } from "@/lib/api";
import { useDescribeError } from "@/lib/errors";
import { formatMinor, WALLET_ID } from "@/lib/money";
import { readWallets, rememberWallet, useSavedWallets } from "@/lib/wallets";

const ASSETS = ["USD", "EUR"] as const;

export function WalletsScreen() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("wallets");
  const actions = useTranslations("actions");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const describeError = useDescribeError();
  const wallets = useSavedWallets();
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [online, setOnline] = useState<boolean | null>(null);
  const [userId, setUserId] = useState("");
  const [asset, setAsset] = useState<(typeof ASSETS)[number]>("USD");
  const [openId, setOpenId] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [pending, setPending] = useState<"create" | "open" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiRequest<{ status: string }>("/health/live")
      .then(() => {
        if (!cancelled) setOnline(true);
      })
      .catch(() => {
        if (!cancelled) setOnline(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    for (const wallet of wallets) {
      void apiRequest<Balance>(`/api/v1/wallets/${wallet.id}/balance`)
        .then((result) => {
          if (cancelled) return;
          setBalances((current) => ({
            ...current,
            [wallet.id]: formatMinor(result.data.balance, result.data.asset, locale),
          }));
        })
        .catch(() => {
          if (cancelled) return;
          setBalances((current) => ({ ...current, [wallet.id]: t("unavailable") }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [locale, t, wallets]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setPending("create");
    try {
      const result = await apiRequest<CreatedWallet>("/api/v1/wallets", {
        method: "POST",
        body: JSON.stringify({ userId: userId.trim(), asset }),
      });
      rememberWallet({
        id: result.data.id,
        userId: result.data.userId,
        asset: result.data.asset,
      });
      router.push(`/wallets/${result.data.id}`);
    } catch (error) {
      setCreateError(describeError(error));
    } finally {
      setPending(null);
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
    setPending("open");
    try {
      const result = await apiRequest<Balance>(`/api/v1/wallets/${id}/balance`);
      const existing = readWallets().find((wallet) => wallet.id === id);
      rememberWallet({
        id,
        userId: existing?.userId ?? "",
        asset: result.data.asset,
      });
      router.push(`/wallets/${id}`);
    } catch (error) {
      setOpenError(describeError(error));
    } finally {
      setPending(null);
    }
  }

  const status = online === null ? t("checking") : online ? t("online") : t("offline");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Heading size="lg">{t("title")}</Heading>
        <Text variant="muted" size="sm" className="mt-1" role="status">
          {status}
        </Text>
      </div>

      <section className="flex flex-col gap-3" aria-label={t("savedLabel")}>
        {wallets.length === 0 ? (
          <Note variant="neutral" size="md">
            {t("empty")}
          </Note>
        ) : (
          wallets.map((wallet) => (
            <Link key={wallet.id} href={`/wallets/${wallet.id}`} className="block">
              <Surface variant="card" padding="md">
                <div className="flex items-baseline justify-between gap-3">
                  <Text variant="balance" size="lg">
                    {balances[wallet.id] ?? common("loadingValue")}
                  </Text>
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
          ))
        )}
      </section>

      <form onSubmit={onCreate} className="flex flex-col gap-4">
        <Heading level={2} size="sm">
          {t("createTitle")}
        </Heading>
        <Field label={t("userId")} hint={t("userIdHint")}>
          <Input
            name="userId"
            autoComplete="username"
            required
            minLength={1}
            maxLength={128}
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
          />
        </Field>
        <Field label={t("asset")}>
          <Select
            name="asset"
            value={asset}
            onChange={(event) => setAsset(event.target.value as (typeof ASSETS)[number])}
          >
            {ASSETS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        {createError ? <Note variant="error">{createError}</Note> : null}
        <Button type="submit" fullWidth pending={pending === "create"} pendingLabel={actions("pending")}>
          {actions("createWallet")}
        </Button>
      </form>

      <form onSubmit={onOpen} className="flex flex-col gap-4">
        <Heading level={2} size="sm">
          {t("openTitle")}
        </Heading>
        <Field label={t("walletId")}>
          <Input
            name="walletId"
            autoComplete="off"
            required
            spellCheck={false}
            value={openId}
            onChange={(event) => setOpenId(event.target.value)}
          />
        </Field>
        {openError ? <Note variant="error">{openError}</Note> : null}
        <Button type="submit" fullWidth pending={pending === "open"} pendingLabel={actions("pending")}>
          {actions("openWallet")}
        </Button>
      </form>
    </div>
  );
}
