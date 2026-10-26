import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn";

export const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-gold text-ink hover:bg-gold-deep",
        secondary: "border border-line bg-surface text-ink hover:bg-gold-soft",
        text: "bg-transparent px-0 text-gold-deep underline-offset-4 hover:underline",
        choice: "border bg-surface text-ink",
      },
      size: {
        sm: "h-9 rounded-control px-3 text-sm",
        md: "h-11 rounded-control px-4 text-sm",
        lg: "h-12 rounded-control px-5 text-base",
      },
      selected: {
        true: "",
        false: "",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    compoundVariants: [
      { variant: "choice", selected: true, class: "border-gold bg-gold-soft" },
      { variant: "choice", selected: false, class: "border-line" },
      { variant: "text", size: "sm", class: "h-auto px-0" },
      { variant: "text", size: "md", class: "h-auto px-0" },
      { variant: "text", size: "lg", class: "h-auto px-0" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "lg",
      selected: false,
      fullWidth: false,
    },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    pending?: boolean;
    pendingLabel?: string;
  };

export function Button({
  className,
  variant,
  size,
  selected,
  fullWidth,
  pending = false,
  pendingLabel,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      className={cn(buttonVariants({ variant, size, selected, fullWidth }), className)}
      {...props}
    >
      <span className={pending ? "invisible" : undefined}>{children}</span>
      {pending ? (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="size-4 animate-spin rounded-full border-2 border-current border-e-transparent" />
        </span>
      ) : null}
      {pending && pendingLabel ? <span className="sr-only">{pendingLabel}</span> : null}
    </button>
  );
}
