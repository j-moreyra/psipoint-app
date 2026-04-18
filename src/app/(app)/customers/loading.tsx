import { Skeleton } from "@/components/ui/skeleton";

// Cascades to every nested customers/* route until a more specific
// loading.tsx overrides it.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-9 w-full" />
      <div className="divide-y rounded-lg border bg-card shadow-sm">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
