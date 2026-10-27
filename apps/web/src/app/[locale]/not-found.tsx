import { getTranslations } from "next-intl/server";
import { Heading } from "@talasea/ui";

export default async function LocaleNotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="flex flex-col gap-2 py-8">
      <Heading size="md">{t("notFound")}</Heading>
    </div>
  );
}
