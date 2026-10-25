import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fa", "en"],
  defaultLocale: "fa",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];

export function directionFor(locale: string): "rtl" | "ltr" {
  return locale === "fa" ? "rtl" : "ltr";
}
