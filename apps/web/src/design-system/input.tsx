"use client";

import type { ComponentProps } from "react";
import { cn } from "./cn";
import { controlVariants, type ControlVariants } from "./control";
import { useFieldControl } from "./field";

type InputProps = Omit<ComponentProps<"input">, "size"> & ControlVariants;

export function Input({
  className,
  variant,
  size,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: InputProps) {
  const field = useFieldControl();

  return (
    <input
      id={id ?? field?.id}
      aria-invalid={ariaInvalid ?? (field?.invalid ? true : undefined)}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      className={cn(controlVariants({ variant, size }), className)}
      {...props}
    />
  );
}
