import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Text } from "@/design-system/text";
import { BottomNav } from "./bottom-nav";
import { LocaleSwitch } from "./locale-switch";

export async function AppShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("shell");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="flex items-center justify-between gap-3 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Text as="p" variant="brand" size="xs">
          {t("brand")}
        </Text>
        <LocaleSwitch />
      </header>
      <main className="flex-1 px-5 pt-6 pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}
