import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block animate-pulse rounded-control bg-line", className)} />;
}
