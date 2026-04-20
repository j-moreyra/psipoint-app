import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-36" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <section key={i} className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="divide-y rounded-lg border bg-card shadow-sm">
            {Array.from({ length: 3 }).map((__, j) => (
              <div
                key={j}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
