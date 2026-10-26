import { getLocale, getTranslations } from "next-intl/server";
import { directionFor } from "@/i18n/routing";

export const instant = false;

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "errors" });

  return (
    <html lang={locale} dir={directionFor(locale)}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#f7f3ea",
          color: "#241c14",
          fontFamily: "sans-serif",
        }}
      >
        {t("notFound")}
      </body>
    </html>
  );
}
