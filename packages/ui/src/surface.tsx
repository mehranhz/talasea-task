import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn";

export const surfaceVariants = cva("", {
  variants: {
    variant: {
      card: "surface-card",
      dashed: "rounded-card border-dashed border-line bg-transparent",
      flat: "rounded-control border-transparent bg-transparent",
    },
    padding: {
      none: "p-0",
      sm: "px-3 py-3",
      md: "px-4 py-4",
    },
  },
  defaultVariants: {
    variant: "card",
    padding: "md",
  },
});

type SurfaceProps = ComponentProps<"div"> & VariantProps<typeof surfaceVariants>;

export function Surface({ variant, padding, className, ...props }: SurfaceProps) {
  return <div className={cn(surfaceVariants({ variant, padding }), className)} {...props} />;
}
