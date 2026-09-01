import { Skeleton } from "@/components/ui/skeleton"

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement du dashboard">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 bg-muted" />
        <Skeleton className="h-4 w-80 max-w-full bg-muted/80" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/80 bg-card p-4">
            <Skeleton className="mb-3 h-4 w-32 bg-muted" />
            <Skeleton className="mb-2 h-8 w-24 bg-muted" />
            <Skeleton className="h-3 w-40 bg-muted/70" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card p-4">
        <Skeleton className="mb-3 h-5 w-56 bg-muted" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="mb-2 h-10 w-full bg-muted/70" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/80 bg-card p-4">
            <Skeleton className="mb-3 h-4 w-40 bg-muted" />
            <Skeleton className="h-[58px] w-full bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  )
}
