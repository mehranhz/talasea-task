import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "./cn";

export const navLinkVariants = cva("nav-tab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", {
  variants: {
    variant: {
      tab: "",
    },
    size: {
      md: "",
    },
    active: {
      true: "",
      false: "",
    },
  },
  defaultVariants: {
    variant: "tab",
    size: "md",
    active: false,
  },
});

type NavLinkProps = VariantProps<typeof navLinkVariants> &
  Omit<ComponentPropsWithoutRef<"a">, "href" | "className"> & {
    as?: ElementType;
    href: string;
    className?: string;
    children?: ReactNode;
  };

export function NavLink({ as, variant, size, active, className, href, ...props }: NavLinkProps) {
  const Comp = as ?? "a";
  return (
    <Comp
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(navLinkVariants({ variant, size, active }), className)}
      {...props}
    />
  );
}
