import { Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Skeleton, Text } from "@talasea/ui";
import type { AppLocale } from "@/i18n/routing";
import { BottomNav } from "./bottom-nav";
import { LocaleSwitch } from "./locale-switch";
import { ThemeSwitch } from "./theme-switch";

export async function AppShell({ children, locale }: { children: ReactNode; locale: AppLocale }) {
  const t = await getTranslations({ locale, namespace: "shell" });

  return (
    <div className="shell">
      <header className="shell-header">
        <Text as="p" variant="brand">
          {t("brand")}
        </Text>
        <div className="shell-tools">
          <Suspense fallback={<Skeleton className="h-11 w-16" />}>
            <ThemeSwitch />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-11 w-28" />}>
            <LocaleSwitch />
          </Suspense>
        </div>
      </header>
      <main className="shell-main">{children}</main>
      <Suspense fallback={<div className="shell-nav" />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
