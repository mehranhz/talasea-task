"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { createContext, useContext, useId, type ReactNode } from "react";
import { cn } from "./cn";
import { Text } from "./text";

export type FieldContextValue = {
  id: string;
  describedBy?: string;
  invalid: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldControl(): FieldContextValue | null {
  return useContext(FieldContext);
}

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
  error?: string;
  children: ReactNode;
  className?: string;
};

export function Field({ label, hint, error, children, size, className }: FieldProps) {
  const uid = useId();
  const id = `${uid}-control`;
  const hintId = hint ? `${uid}-hint` : undefined;
  const errorId = error ? `${uid}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <label htmlFor={id} className={cn(fieldVariants({ size }), className)}>
        <Text as="span" variant="label" size="sm" className="mb-1.5 block">
          {label}
        </Text>
        {children}
        {hint ? (
          <Text id={hintId} as="span" variant="muted" size="xs" className="mt-1.5 block leading-5">
            {hint}
          </Text>
        ) : null}
        {error ? (
          <Text id={errorId} as="span" variant="body" size="xs" role="alert" className="mt-1.5 block leading-5 text-danger">
            {error}
          </Text>
        ) : null}
      </label>
    </FieldContext.Provider>
  );
}
