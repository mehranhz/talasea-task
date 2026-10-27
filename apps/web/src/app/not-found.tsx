import { getLocale, getTranslations } from "next-intl/server";
import { directionFor } from "@/i18n/routing";
import "./globals.css";

export const instant = false;

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "errors" });

  return (
    <html lang={locale} dir={directionFor(locale)}>
      <body className="m-0 grid min-h-dvh place-items-center bg-paper font-sans text-ink">
        {t("notFound")}
      </body>
    </html>
  );
}
