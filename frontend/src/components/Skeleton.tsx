/**
 * Reusable shimmer skeleton primitives for instant perceived responsiveness
 * during class switches, initial page loads, and table fetches.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-[#E2E8F0] ${className}`}
    />
  );
}

export function CourseRepDashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading class dashboard">
      {/* Control Panel Skeleton */}
      <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-7 w-52" />
              <Skeleton className="h-7 w-24 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Skeleton className="h-8 w-36 rounded-lg" />
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Verification Settings Skeleton */}
      <div className="bg-white border border-[#D0D7DE] rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
      </div>

      {/* 3 Stat Gauges Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="neu-raised p-4 flex items-center justify-between"
          >
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-14" />
            </div>
            <Skeleton className="w-10 h-10 rounded-xl" />
          </div>
        ))}
      </div>

      {/* Roster Table Skeleton */}
      <div className="bg-white border border-[#D0D7DE] rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#D0D7DE] flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-64 max-w-full rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <div className="divide-y divide-[#E1E4E8]">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="px-4 py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
