import type { ComponentProps } from "react";
import { cn } from "./cn";
import { controlVariants, type ControlVariants } from "./control";

type InputProps = Omit<ComponentProps<"input">, "size"> & ControlVariants;

export function Input({ className, variant, size, ...props }: InputProps) {
  return <input className={cn(controlVariants({ variant, size }), className)} {...props} />;
}
