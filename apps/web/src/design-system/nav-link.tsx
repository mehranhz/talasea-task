import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "./cn";

export const navLinkVariants = cva(
  "inline-flex w-full items-center justify-center font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  {
    variants: {
      variant: {
        tab: "",
      },
      size: {
        md: "h-14 text-sm",
      },
      active: {
        true: "text-pine",
        false: "text-muted",
      },
    },
    defaultVariants: {
      variant: "tab",
      size: "md",
      active: false,
    },
  },
);

type NavLinkProps = ComponentProps<typeof Link> & VariantProps<typeof navLinkVariants>;

export function NavLink({ variant, size, active, className, ...props }: NavLinkProps) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(navLinkVariants({ variant, size, active }), className)}
      {...props}
    />
  );
}
