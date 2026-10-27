"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@talasea/ui";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitch() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("locales");
  const shell = useTranslations("shell");

  return (
    <div role="group" aria-label={shell("localeLabel")} className="tool-group">
      {routing.locales.map((item) => (
        <Button
          key={item}
          type="button"
          variant="choice"
          size="md"
          selected={item === locale}
          onClick={() => router.replace(pathname, { locale: item })}
        >
          {t(item)}
        </Button>
      ))}
    </div>
  );
}
