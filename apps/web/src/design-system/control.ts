import { cva, type VariantProps } from "class-variance-authority";

export const controlVariants = cva(
  "w-full border bg-surface text-ink outline-none transition-colors placeholder:text-muted focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-60",
  {
    variants: {
      variant: {
        outline: "border-line",
        subtle: "border-transparent bg-gold-soft",
      },
      size: {
        sm: "h-9 rounded-control px-3 text-sm",
        md: "h-11 rounded-control px-3.5 text-base",
        lg: "h-12 rounded-control px-4 text-base",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "lg",
    },
  },
);

export type ControlVariants = VariantProps<typeof controlVariants>;
