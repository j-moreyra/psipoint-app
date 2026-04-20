import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-56" />
      </div>
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </section>
      {Array.from({ length: 2 }).map((_, i) => (
        <section
          key={i}
          className="space-y-4 rounded-lg border bg-card p-5 shadow-sm"
        >
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-9 w-32" />
        </section>
      ))}
    </div>
  );
}
