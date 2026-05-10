/** Reusable skeleton shimmer primitives */

function Shimmer({ className = '' }) {
  return (
    <div className={`animate-pulse rounded bg-slate-200 ${className}`} />
  )
}

/** A single horizontal bar */
export function SkeletonLine({ className = 'h-4 w-full' }) {
  return <Shimmer className={className} />
}

/** Generic rows of bars — for lists and simple text blocks */
export function SkeletonLines({ rows = 4, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <Shimmer key={i} className={`h-4 ${i % 3 === 2 ? 'w-3/4' : 'w-full'}`} />
      ))}
    </div>
  )
}

/** Table skeleton: header row + N body rows with C columns */
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      {/* header */}
      <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Shimmer key={i} className={`h-3 ${i === 0 ? 'w-1/4' : 'flex-1'}`} />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="border-b border-slate-100 last:border-0 px-4 py-3 flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <Shimmer key={c} className={`h-3.5 ${c === 0 ? 'w-1/4' : 'flex-1'} ${c === cols - 1 ? 'w-16' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Card grid skeleton — for lists of cards */
export function SkeletonCards({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-4 space-y-2">
          <Shimmer className="h-4 w-2/5" />
          <Shimmer className="h-3 w-3/5" />
          <Shimmer className="h-3 w-1/4" />
        </div>
      ))}
    </div>
  )
}

/** Detail page skeleton — title block + sections */
export function SkeletonDetail() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Shimmer className="h-5 w-1/3" />
        <Shimmer className="h-3 w-1/2" />
      </div>
      <div className="rounded-lg border border-slate-200 p-5 space-y-4">
        <Shimmer className="h-4 w-1/4" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Shimmer className="h-3 w-1/3" />
              <Shimmer className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 p-5 space-y-3">
        <Shimmer className="h-4 w-1/5" />
        <SkeletonLines rows={3} />
      </div>
    </div>
  )
}

/** Wizard / form skeleton */
export function SkeletonForm({ fields = 6 }) {
  return (
    <div className="space-y-4">
      <div className="border-b border-slate-100 pb-4 space-y-1">
        <Shimmer className="h-5 w-1/4" />
        <Shimmer className="h-3 w-2/5" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Shimmer className="h-3 w-1/3" />
            <Shimmer className="h-9 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
