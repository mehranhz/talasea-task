import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn";

export const noteVariants = cva("rounded-control", {
  variants: {
    variant: {
      error: "bg-danger-soft text-danger",
      replay: "bg-gold-soft text-ink",
      neutral: "border border-dashed border-line text-muted",
    },
    size: {
      sm: "px-3 py-2 text-sm",
      md: "px-4 py-8 text-center text-sm",
    },
  },
  defaultVariants: {
    variant: "neutral",
    size: "sm",
  },
});

type NoteProps = ComponentProps<"p"> & VariantProps<typeof noteVariants>;

export function Note({ variant, size, className, ...props }: NoteProps) {
  return (
    <p
      role={variant === "error" ? "alert" : "status"}
      className={cn(noteVariants({ variant, size }), className)}
      {...props}
    />
  );
}
