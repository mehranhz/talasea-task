import { cva, type VariantProps } from "class-variance-authority";

export const controlVariants = cva(
  "control w-full rounded-control outline-none transition-[color,background-color,border-color,box-shadow] duration-[180ms] placeholder:text-muted disabled:opacity-60",
  {
    variants: {
      variant: {
        outline: "border-line",
        subtle: "border-transparent bg-accent-soft",
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
