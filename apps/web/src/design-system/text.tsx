import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn";

export const textVariants = cva("", {
  variants: {
    variant: {
      body: "text-ink",
      muted: "text-muted",
      label: "font-medium text-ink",
      brand: "font-semibold tracking-[0.22em] text-gold-deep uppercase",
      balance: "font-semibold tracking-tight text-ink",
      positive: "font-semibold text-pine",
    },
    size: {
      xs: "text-xs",
      sm: "text-sm",
      md: "text-base",
      lg: "text-2xl",
      display: "text-4xl",
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
  return <Tag className={cn(textVariants({ variant, size }), className)} {...props} />;
}
