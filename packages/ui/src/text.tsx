import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn";

export const textVariants = cva("", {
  variants: {
    variant: {
      body: "text-ink",
      muted: "text-muted",
      label: "font-medium text-ink",
      brand: "brand-mark text-xs",
      balance: "balance-card",
      positive: "font-semibold text-credit",
    },
    size: {
      xs: "text-xs",
      sm: "text-sm",
      md: "text-base",
      lg: "text-2xl",
      display: "text-4xl",
      figure: "",
    },
  },
  defaultVariants: {
    variant: "body",
    size: "md",
  },
});

type TextProps = ComponentProps<"p"> &
  VariantProps<typeof textVariants> & {
    as?: "p" | "span";
  };

export function Text({ as = "p", className, variant, size, ...props }: TextProps) {
  const Tag = as;
  const fixed = variant === "balance" || variant === "brand";
  return <Tag className={cn(textVariants({ variant, size: fixed ? undefined : size }), className)} {...props} />;
}
