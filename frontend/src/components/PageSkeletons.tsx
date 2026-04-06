import { Skeleton } from '@/components/ui/skeleton';

function StatSkeleton() {
  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-7 w-12 mb-1" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          {Array.from({ length: lines - 1 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" style={{ width: `${80 - i * 15}%` }} />
          ))}
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-4 w-14 rounded-full" />
            <Skeleton className="h-4 w-10 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanColumnSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="flex-shrink-0 w-[260px] bg-secondary/30 rounded-lg border border-border/50">
      <div className="flex items-center gap-2 p-3 border-b border-border/30">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <div className="p-2 space-y-2">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="rounded-lg bg-card border border-border p-3 space-y-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex gap-1.5">
              <Skeleton className="h-4 w-12 rounded-full" />
              <Skeleton className="h-4 w-8 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-6xl animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <StatSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl bg-card border border-border p-5 space-y-3">
            <Skeleton className="h-4 w-16" />
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center gap-3 py-1.5">
                <Skeleton className="w-4 h-4 rounded-full" />
                <Skeleton className="h-3 flex-1" style={{ width: `${70 - j * 10}%` }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FavoritesSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-300">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <CardSkeleton key={i} lines={2} />
      ))}
    </div>
  );
}

export function MeetingsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="rounded-xl bg-card border border-border p-5 space-y-3">
          <div className="flex items-start justify-between">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-8" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function ProjectsSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 animate-in fade-in duration-300">
      {[1, 2, 3, 4, 5].map((i) => (
        <KanbanColumnSkeleton key={i} cards={i % 2 === 0 ? 2 : 3} />
      ))}
    </div>
  );
}

export function KnowledgeSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border/50 rounded-xl p-3 flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-2 w-12" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function AgentsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
      {[1, 2, 3].map((col) => (
        <div key={col}>
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-5 w-20 rounded" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-card border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="w-2 h-2 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <div className="flex gap-1">
                  <Skeleton className="h-4 w-16 rounded" />
                  <Skeleton className="h-4 w-12 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
