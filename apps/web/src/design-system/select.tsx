"use client";

import type { ComponentProps } from "react";
import { cn } from "./cn";
import { controlVariants, type ControlVariants } from "./control";
import { useFieldControl } from "./field";

type SelectProps = Omit<ComponentProps<"select">, "size"> & ControlVariants;

export function Select({
  className,
  variant,
  size,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: SelectProps) {
  const field = useFieldControl();

  return (
    <select
      id={id ?? field?.id}
      aria-invalid={ariaInvalid ?? (field?.invalid ? true : undefined)}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      className={cn(controlVariants({ variant, size }), className)}
      {...props}
    />
  );
}
