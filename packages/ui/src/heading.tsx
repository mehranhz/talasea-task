import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn";

export const headingVariants = cva("font-semibold", {
  variants: {
    size: {
      sm: "text-xl tracking-tight text-ink",
      md: "text-2xl tracking-tight text-ink",
      lg: "text-3xl tracking-tight text-ink",
      display: "balance-figure",
    },
  },
  defaultVariants: {
    size: "lg",
  },
});

const tags = { 1: "h1", 2: "h2", 3: "h3" } as const;

type HeadingProps = ComponentProps<"h1"> &
  VariantProps<typeof headingVariants> & {
    level?: keyof typeof tags;
  };

export function Heading({ level = 1, size, className, ...props }: HeadingProps) {
  const Tag = tags[level];
  return <Tag className={cn(headingVariants({ size }), className)} {...props} />;
}
