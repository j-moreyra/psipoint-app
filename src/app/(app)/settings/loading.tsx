import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 rounded-lg border bg-card p-6 shadow-sm">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <div className="flex justify-end pt-2">
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}
