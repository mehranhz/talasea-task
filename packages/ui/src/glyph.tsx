import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";

export function Glyph({
  icon: Icon,
  directional = false,
  className,
}: {
  icon: LucideIcon;
  directional?: boolean;
  className?: string;
}) {
  return (
    <Icon
      aria-hidden
      strokeWidth={1.75}
      className={cn("size-4 shrink-0", directional && "icon-directional", className)}
    />
  );
}
