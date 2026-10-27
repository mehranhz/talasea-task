"use client";

import { ArrowLeftRight, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { Glyph, NavLink } from "@talasea/ui";
import { Link, usePathname } from "@/i18n/navigation";

const links = [
  { href: "/", key: "wallets", icon: Wallet, match: (path: string) => path === "/" || path.startsWith("/wallets") },
  { href: "/transfer", key: "transfer", icon: ArrowLeftRight, match: (path: string) => path.startsWith("/transfer") },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const shell = useTranslations("shell");

  return (
    <nav aria-label={shell("navLabel")} className="shell-nav">
      <div className="shell-nav-row">
        {links.map((link) => (
          <NavLink as={Link} key={link.href} href={link.href} active={link.match(pathname)}>
            <Glyph icon={link.icon} className="size-5" />
            {t(link.key)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
