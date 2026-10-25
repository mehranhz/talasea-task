import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn";

export const headingVariants = cva("font-semibold tracking-tight text-ink", {
  variants: {
    size: {
      sm: "text-xl",
      md: "text-2xl",
      lg: "text-3xl",
      display: "text-4xl",
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
