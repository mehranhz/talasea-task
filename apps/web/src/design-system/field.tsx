import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { Text } from "./text";

const fieldVariants = cva("block", {
  variants: {
    size: {
      sm: "text-sm",
      md: "text-base",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

type FieldProps = VariantProps<typeof fieldVariants> & {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
};

export function Field({ label, hint, children, size, className }: FieldProps) {
  return (
    <label className={cn(fieldVariants({ size }), className)}>
      <Text as="span" variant="label" size="sm" className="mb-1.5 block">
        {label}
      </Text>
      {children}
      {hint ? (
        <Text as="span" variant="muted" size="xs" className="mt-1.5 block leading-5">
          {hint}
        </Text>
      ) : null}
    </label>
  );
}
