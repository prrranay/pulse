export function PostSkeleton() {
  return (
    <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-5 backdrop-blur-xl animate-pulse">
      <div className="flex items-start gap-3">
        {/* Avatar skeleton */}
        <div className="h-10 w-10 shrink-0 rounded-full bg-slate-800" />

        {/* Content skeleton */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-24 rounded bg-slate-800" />
            <div className="h-3 w-16 rounded bg-slate-800" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-slate-800" />
            <div className="h-3 w-4/5 rounded bg-slate-800" />
          </div>
          <div className="flex justify-between pt-2">
            <div className="h-3.5 w-8 rounded bg-slate-800" />
            <div className="h-3.5 w-8 rounded bg-slate-800" />
            <div className="h-3.5 w-8 rounded bg-slate-800" />
            <div className="h-3.5 w-8 rounded bg-slate-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
