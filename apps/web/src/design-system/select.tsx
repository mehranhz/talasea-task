import type { ComponentProps } from "react";
import { cn } from "./cn";
import { controlVariants, type ControlVariants } from "./control";

type SelectProps = Omit<ComponentProps<"select">, "size"> & ControlVariants;

export function Select({ className, variant, size, ...props }: SelectProps) {
  return <select className={cn(controlVariants({ variant, size }), className)} {...props} />;
}
