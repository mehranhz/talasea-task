import { Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/design-system/skeleton";
import { Text } from "@/design-system/text";
import type { AppLocale } from "@/i18n/routing";
import { BottomNav } from "./bottom-nav";
import { LocaleSwitch } from "./locale-switch";

export async function AppShell({ children, locale }: { children: ReactNode; locale: AppLocale }) {
  const t = await getTranslations({ locale, namespace: "shell" });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="flex items-center justify-between gap-3 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Text as="p" variant="brand" size="xs">
          {t("brand")}
        </Text>
        <Suspense fallback={<Skeleton className="h-9 w-28" />}>
          <LocaleSwitch />
        </Suspense>
      </header>
      <main className="flex-1 px-5 pt-6 pb-28">{children}</main>
      <Suspense fallback={<div className="fixed inset-x-0 bottom-0 h-16 border-t border-line bg-surface" />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
