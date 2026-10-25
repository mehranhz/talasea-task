import { getTranslations } from "next-intl/server";
import { Text } from "@/design-system";

export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <Text variant="muted" size="sm" role="status">
      {t("loading")}
    </Text>
  );
}
