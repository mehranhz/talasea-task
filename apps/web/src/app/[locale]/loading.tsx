import { Skeleton } from "@/design-system";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
