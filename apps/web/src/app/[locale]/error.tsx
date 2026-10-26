"use client";

import { useTranslations } from "next-intl";
import { Button, Note } from "@/design-system";

export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  const actions = useTranslations("actions");

  return (
    <div className="flex flex-col gap-4">
      <Note variant="error">{t("unknown")}</Note>
      <Button type="button" variant="secondary" onClick={reset}>
        {actions("retry")}
      </Button>
    </div>
  );
}
