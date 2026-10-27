"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@talasea/ui";

export default function Loading() {
  const t = useTranslations("common");

  return (
    <div className="flex flex-col gap-6" role="status">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
