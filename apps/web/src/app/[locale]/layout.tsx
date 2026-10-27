import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Vazirmatn } from "next/font/google";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { QueryProvider } from "@/components/query-provider";
import { AppShell } from "@/components/shell/app-shell";
import { ServiceWorkerRegister } from "@/components/shell/service-worker-register";
import { themeInitScript } from "@/components/shell/theme-script";
import { routing, directionFor } from "@/i18n/routing";
import "../globals.css";

const sans = Vazirmatn({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-vazirmatn",
});

const timeZone = "Asia/Tehran";

async function requestNow() {
  "use cache";
  return new Date();
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2ee" },
    { media: "(prefers-color-scheme: dark)", color: "#101114" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("title"),
    description: t("description"),
    applicationName: t("applicationName"),
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: t("applicationName"),
      statusBarStyle: "default",
    },
    icons: {
      icon: [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages({ locale });
  const now = await requestNow();

  return (
    <html lang={locale} dir={directionFor(locale)} className={sans.variable} suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone} now={now} formats={{}}>
          <QueryProvider>
            <ServiceWorkerRegister />
            <AppShell locale={locale}>{children}</AppShell>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
