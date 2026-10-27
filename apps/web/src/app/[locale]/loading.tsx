import { getTranslations } from "next-intl/server";
import { Skeleton } from "@talasea/ui";

export default async function Loading() {
  const t = await getTranslations("common");

  return (
    <div className="flex flex-col gap-6" role="status">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
