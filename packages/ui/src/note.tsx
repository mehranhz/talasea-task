import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, Inbox, Info, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";
import { Glyph } from "./glyph";

export const noteVariants = cva("rounded-control", {
  variants: {
    variant: {
      error: "bg-danger-soft text-danger",
      replay: "bg-accent-soft text-ink",
      neutral: "note-quiet",
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

const noteIcons = {
  error: AlertCircle,
  replay: Info,
  neutral: Inbox,
} satisfies Record<NonNullable<VariantProps<typeof noteVariants>["variant"]>, LucideIcon>;

type NoteProps = Omit<ComponentProps<"p">, "children"> &
  VariantProps<typeof noteVariants> & {
    children?: ReactNode;
  };

export function Note({ variant = "neutral", size, className, children, ...props }: NoteProps) {
  const stacked = size === "md";
  return (
    <p
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        noteVariants({ variant, size }),
        stacked ? "flex flex-col items-center gap-2" : "flex items-start gap-2",
        className,
      )}
      {...props}
    >
      <Glyph icon={noteIcons[variant ?? "neutral"]} />
      <span>{children}</span>
    </p>
  );
}
