"use client";

import { cn } from "@/lib/utils";

/**
 * Shimmer-loader rectangle. Use as <Skeleton className="h-4 w-32" /> etc.
 * Animation defined in globals.css `.skeleton` + tailwind keyframes.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function KPISkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5 shadow-card">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-7 w-16" />
      <Skeleton className="mt-2 h-3 w-24" />
    </div>
  );
}

export function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-1.5 h-3 w-44" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <div
        className="grid border-b border-border bg-muted/60 px-3 py-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="mr-2 h-3 w-16" />
        ))}
      </div>
      <div className="divide-y divide-border/60">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid px-3"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              height: "var(--density-row)",
              alignItems: "center",
            }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="mr-2 h-3 w-3/4" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
