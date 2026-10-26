"use client";

import { useTranslations } from "next-intl";
import { NavLink } from "@/design-system/nav-link";
import { usePathname } from "@/i18n/navigation";

const links = [
  { href: "/", key: "wallets", match: (path: string) => path === "/" || path.startsWith("/wallets") },
  { href: "/transfer", key: "transfer", match: (path: string) => path.startsWith("/transfer") },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const shell = useTranslations("shell");

  return (
    <nav aria-label={shell("navLabel")} className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-2 pb-[env(safe-area-inset-bottom)]">
        {links.map((link) => (
          <NavLink key={link.href} href={link.href} active={link.match(pathname)}>
            {t(link.key)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
